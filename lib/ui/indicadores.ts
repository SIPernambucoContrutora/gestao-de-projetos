/* ------------------------------------------------------------------ *
 * Regras de cálculo da tela de Indicadores.
 *
 * Funções PURAS — nenhum I/O. Rodam no cliente, sobre o conjunto que
 * getDadosIndicadores() trouxe uma vez, e é isso que faz o cross-filter
 * responder no clique.
 *
 * Princípio que não se negocia aqui: o estado de um item é o que
 * derivarStatus() (lib/ui/status.ts) disser, nunca uma releitura das datas
 * feita neste arquivo. Se um gráfico e um badge discordarem sobre o que é
 * "Atrasado", o painel inteiro perde a credibilidade na primeira reunião.
 * ------------------------------------------------------------------ */

import type { LinhaIndicador } from "@/lib/actions/analytics";
import type { Tom } from "@/lib/ui/status";
import { derivarStatus, parseISO } from "@/lib/ui/status";

/* ------------------------------------------------------------------ *
 * Estado do item — seis baldes, os mesmos seis tons dos badges
 * ------------------------------------------------------------------ */

export const ROTULO_ESTADO: Record<Tom, string> = {
  verde: "Finalizado",
  azul: "Em análise",
  rosa: "Ajustes pós análise",
  ambar: "Em andamento",
  vermelho: "Atrasado",
  cinza: "Pendente",
};

/** O balde do item hoje. Delegado a derivarStatus: fonte única da regra. */
export function estado(l: LinhaIndicador, hoje: Date): Tom {
  return derivarStatus(l, hoje).tom;
}

/** Itens ainda em aberto (tudo que não está finalizado/entregue). */
export function emAberto(l: LinhaIndicador): boolean {
  return l.status !== "finalizado" && !l.prazoRealizado;
}

/* ------------------------------------------------------------------ *
 * Datas
 * ------------------------------------------------------------------ */

/** Diferença em dias entre duas datas 'YYYY-MM-DD' (a − b). */
export function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

/** O prazo que está valendo: o reprogramado tem precedência sobre o previsto. */
export function prazoVigente(l: LinhaIndicador): string | null {
  return l.prazoReprogramado ?? l.prazoPrevisto;
}

/**
 * Dias de atraso de um item AINDA EM ABERTO (null se em dia ou já entregue).
 * O aging é contra hoje: um atraso em aberto cresce todo dia.
 */
export function atrasoDias(l: LinhaIndicador, hojeISO: string): number | null {
  if (!emAberto(l)) return null;
  const alvo = prazoVigente(l);
  if (!alvo || alvo >= hojeISO) return null;
  return diasEntre(hojeISO, alvo);
}

/**
 * Entregue dentro do prazo ORIGINAL. Entregar na data reprogramada continua
 * sendo atraso — a mesma régua do desvio em derivarStatus.
 */
export function noPrazo(l: LinhaIndicador): boolean | null {
  if (!l.prazoRealizado || !l.prazoPrevisto) return null;
  return l.prazoRealizado <= l.prazoPrevisto;
}

/** Dias que o projetista levou do início até a entrega dele. */
export function leadProjetista(l: LinhaIndicador): number | null {
  if (!l.entregaProjetista || !l.dataInicio) return null;
  const d = diasEntre(l.entregaProjetista, l.dataInicio);
  return d >= 0 ? d : null;
}

/** Da entrega do projetista até o item ser dado como realizado (análise + fechamento). */
export function tempoAnalise(l: LinhaIndicador): number | null {
  if (!l.prazoRealizado || !l.entregaProjetista) return null;
  const d = diasEntre(l.prazoRealizado, l.entregaProjetista);
  return d >= 0 ? d : null;
}

/** Ciclo completo do item: início → realizado. */
export function cicloTotal(l: LinhaIndicador): number | null {
  if (!l.prazoRealizado || !l.dataInicio) return null;
  const d = diasEntre(l.prazoRealizado, l.dataInicio);
  return d >= 0 ? d : null;
}

/** Data de referência do item para o corte por período. */
export function dataReferencia(l: LinhaIndicador): string | null {
  return l.criadoEm ?? l.dataInicio ?? l.prazoPrevisto;
}

/* ------------------------------------------------------------------ *
 * Estatística
 * ------------------------------------------------------------------ */

/** Percentil por interpolação linear. `p` em 0..1. Null se a amostra for vazia. */
export function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  if (v.length === 1) return v[0];
  const pos = (v.length - 1) * p;
  const base = Math.floor(pos);
  const resto = pos - base;
  return v[base] + (v[base + 1] - v[base]) * resto;
}

export function mediana(valores: number[]): number | null {
  return percentil(valores, 0.5);
}

/** Razão em %, com denominador zero devolvendo null (e não 0%, que mentiria). */
export function taxa(parte: number, total: number): number | null {
  return total > 0 ? (parte / total) * 100 : null;
}

/* ------------------------------------------------------------------ *
 * Séries temporais
 * ------------------------------------------------------------------ */

/** Segunda-feira da semana de uma data 'YYYY-MM-DD'. */
export function semanaDe(iso: string): string {
  const d = parseISO(iso);
  if (!d) return iso;
  // getDay(): 0=domingo. Recuar até a segunda.
  const recuo = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - recuo);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function mesDe(iso: string): string {
  return iso.slice(0, 7);
}

/** Lista de semanas (segundas) de `de` até `ate`, inclusive. */
export function semanasEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  const fim = parseISO(semanaDe(ate));
  let cur = parseISO(semanaDe(de));
  if (!cur || !fim) return out;
  // Teto de segurança: 5 anos de semanas. Um cadastro com data digitada
  // errada (ano 1900) não pode gerar um laço de cem mil iterações.
  let guarda = 0;
  while (cur <= fim && guarda++ < 260) {
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    out.push(`${cur.getFullYear()}-${mm}-${dd}`);
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Filtros
 * ------------------------------------------------------------------ */

export type Periodo = "30" | "90" | "180" | "365" | "tudo";

export type Filtros = {
  empreendimentos: string[];
  tipos: string[];
  fases: string[];
  disciplinas: string[];
  categorias: string[];
  etapas: string[];
  projetistas: string[];
  prioridades: string[];
  estados: Tom[];
  periodo: Periodo;
  apenasAbertos: boolean;
};

export const FILTROS_VAZIOS: Filtros = {
  empreendimentos: [],
  tipos: [],
  fases: [],
  disciplinas: [],
  categorias: [],
  etapas: [],
  projetistas: [],
  prioridades: [],
  estados: [],
  periodo: "tudo",
  apenasAbertos: false,
};

/** Quantos filtros estão ativos (para o "limpar" mostrar o que vai sumir). */
export function contarFiltros(f: Filtros): number {
  return (
    f.empreendimentos.length +
    f.tipos.length +
    f.fases.length +
    f.disciplinas.length +
    f.categorias.length +
    f.etapas.length +
    f.projetistas.length +
    f.prioridades.length +
    f.estados.length +
    (f.periodo === "tudo" ? 0 : 1) +
    (f.apenasAbertos ? 1 : 0)
  );
}

/** Lista vazia = "sem restrição". */
function aceita(lista: string[], valor: string | null): boolean {
  if (lista.length === 0) return true;
  return valor !== null && lista.includes(valor);
}

export function aplicarFiltros(
  itens: LinhaIndicador[],
  f: Filtros,
  hojeISO: string,
): LinhaIndicador[] {
  const hoje = parseISO(hojeISO) ?? new Date();
  let corte: string | null = null;
  if (f.periodo !== "tudo") {
    const d = parseISO(hojeISO);
    if (d) {
      d.setDate(d.getDate() - Number(f.periodo));
      corte = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
    }
  }

  return itens.filter((l) => {
    if (!aceita(f.empreendimentos, l.empreendimentoId)) return false;
    if (!aceita(f.tipos, l.empreendimentoTipo)) return false;
    if (!aceita(f.fases, l.empreendimentoFase)) return false;
    if (!aceita(f.disciplinas, l.disciplinaId)) return false;
    if (!aceita(f.categorias, l.disciplinaCategoria)) return false;
    if (!aceita(f.etapas, l.etapaId)) return false;
    if (!aceita(f.projetistas, l.projetistaId)) return false;
    if (!aceita(f.prioridades, l.prioridade)) return false;
    if (f.apenasAbertos && !emAberto(l)) return false;
    if (f.estados.length > 0 && !f.estados.includes(estado(l, hoje))) return false;
    if (corte) {
      const ref = dataReferencia(l);
      // Item sem nenhuma data de referência não some no recorte temporal:
      // some seria pior — ele existe e continua consumindo a carteira.
      if (ref && ref < corte) return false;
    }
    return true;
  });
}

/** Alterna um valor dentro de uma das listas de filtro (o clique no gráfico). */
export function alternar<T extends string>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

/* ------------------------------------------------------------------ *
 * Agrupamento
 * ------------------------------------------------------------------ */

/** Conta os itens por balde de estado, na ordem de empilhamento. */
export function contarEstados(itens: LinhaIndicador[], hoje: Date): Record<Tom, number> {
  const out: Record<Tom, number> = {
    verde: 0,
    azul: 0,
    rosa: 0,
    ambar: 0,
    vermelho: 0,
    cinza: 0,
  };
  for (const l of itens) out[estado(l, hoje)]++;
  return out;
}

/** Agrupa por uma chave, preservando um rótulo legível por grupo. */
export function agrupar<T>(
  itens: LinhaIndicador[],
  chave: (l: LinhaIndicador) => string | null,
  rotulo: (l: LinhaIndicador) => string,
  resumir: (grupo: LinhaIndicador[], id: string, nome: string) => T,
): T[] {
  const mapa = new Map<string, { nome: string; linhas: LinhaIndicador[] }>();
  for (const l of itens) {
    const k = chave(l);
    if (k === null) continue;
    const g = mapa.get(k);
    if (g) g.linhas.push(l);
    else mapa.set(k, { nome: rotulo(l), linhas: [l] });
  }
  return [...mapa.entries()].map(([id, g]) => resumir(g.linhas, id, g.nome));
}
