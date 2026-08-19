import type { StatusItem } from "@/db/schema";

/* ------------------------------------------------------------------ *
 * Derivação visual do status — porta a lógica `derive()` do protótipo.
 * A cor NUNCA é escolhida à mão: é derivada de (status + prazos + hoje).
 * Usado no servidor e no cliente, então é puro (sem I/O).
 * ------------------------------------------------------------------ */

export type Tom = "verde" | "ambar" | "vermelho" | "cinza" | "azul";

export const ROTULO_STATUS: Record<StatusItem, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  em_analise: "Em análise",
  finalizado: "Finalizado",
};

/**
 * Prioridade de exibição por status (menor = mais acima nas listagens).
 * Pendente primeiro (é o que precisa ser programado com urgência) e
 * finalizado por último. Espelha o CASE do ORDER BY em lib/actions/itens.
 */
export const ORDEM_STATUS: Record<StatusItem, number> = {
  pendente: 0,
  em_andamento: 1,
  em_analise: 2,
  finalizado: 3,
};

/**
 * Nome curto de um usuário do Neon Auth para exibição ("Em análise por X").
 * Cai no trecho antes do @ do e-mail quando não há nome cadastrado.
 */
export function rotuloUsuario(
  name: string | null | undefined,
  email?: string | null,
): string {
  const n = name?.trim();
  if (n) return n;
  const e = email?.trim();
  if (e) return e.split("@")[0];
  return "usuário";
}

// Rótulos legíveis dos campos gravados no histórico (itens e empreendimentos).
export const ROTULO_CAMPO_HISTORICO: Record<string, string> = {
  status: "status",
  planta: "planta",
  item: "item",
  disciplina: "disciplina",
  etapa: "etapa",
  data_inicio: "data de início",
  prazo_previsto: "prazo previsto",
  prazo_reprogramado: "prazo reprogramado",
  prazo_realizado: "prazo realizado",
  usuario_analise: "usuário da análise",
  meta_dias: "meta",
  observacoes: "observações",
  nome: "nome",
  responsavel: "responsável",
  revisao_atual: "revisão atual",
  data_revisao: "data da revisão",
};

export function rotuloCampo(campo: string | null | undefined): string {
  if (!campo) return "";
  return ROTULO_CAMPO_HISTORICO[campo] ?? campo;
}

/** Converte uma data ISO ('YYYY-MM-DD') em Date local, ou null se vazia. */
export function parseISO(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Formata 'YYYY-MM-DD' como 'dd/mm/yyyy' (ou '—' se vazio). */
export function formatBR(s: string | null | undefined): string {
  const d = parseISO(s);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Formata um timestamp como 'dd/mm/aaaa hh:mm' no fuso de Pernambuco
 * (America/Recife, UTC-3). Determinístico — independe do TZ do servidor,
 * evitando divergência entre render no servidor e no cliente.
 */
export function formatDataHora(valor: string | Date): string {
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Recife",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diffDias(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export type ItemDatas = {
  status: StatusItem;
  prazoPrevisto?: string | null;
  prazoReprogramado?: string | null;
  prazoRealizado?: string | null;
  // Nome de quem conduz a análise — usado no rótulo "Em análise por X".
  usuarioAnaliseNome?: string | null;
};

export type StatusDerivado = {
  tom: Tom;
  rotulo: string;
  atrasado: boolean;
  desvio: string; // "Finalizado no prazo" | "3 dias para o vencimento do prazo" | "Atraso de 3 dias" | "—"
  desvioTom: Tom; // tom do campo de desvio (verde/vermelho/cinza)
};

function textoAtraso(dias: number, prefixo = ""): string {
  return `${prefixo}atraso de ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

function textoAVencer(dias: number): string {
  if (dias === 0) return "Vence hoje";
  return `${dias} ${dias === 1 ? "dia" : "dias"} para o vencimento do prazo`;
}

/**
 * Deriva tom/rótulo/desvio de um item. `hoje` é injetável para manter
 * a renderização determinística (evita divergência server/client).
 */
export function derivarStatus(it: ItemDatas, hoje: Date): StatusDerivado {
  const alvo = parseISO(it.prazoReprogramado) ?? parseISO(it.prazoPrevisto);
  const real = parseISO(it.prazoRealizado);

  let tom: Tom = "cinza";
  let rotulo = ROTULO_STATUS[it.status];

  if (it.status === "finalizado") {
    tom = "verde";
  } else if (it.status === "em_analise") {
    // Em análise tem cor e filtro próprios — não vira "Atrasado" mesmo com
    // o prazo vencido, já que o item está com o analista, não parado.
    tom = "azul";
  } else if (alvo && alvo < hoje) {
    tom = "vermelho";
    rotulo = "Atrasado";
  } else if (it.status === "em_andamento") {
    tom = "ambar";
  }

  // Em análise identifica QUEM analisa — a informação é mais útil que o
  // rótulo genérico, então prevalece sobre "Atrasado" (o tom vermelho fica).
  if (it.status === "em_analise" && it.usuarioAnaliseNome) {
    rotulo = `Em análise por ${it.usuarioAnaliseNome}`;
  }

  // Desvio: texto explícito + tom próprio.
  // O finalizado é medido contra o prazo PREVISTO (o original), não contra o
  // reprogramado — entregar na data reprogramada continua sendo atraso.
  //  · finalizado até o previsto  → verde  ("Finalizado no prazo")
  //  · finalizado após o previsto → âmbar  ("Finalizado com atraso de N dias")
  //  · em aberto, alvo no futuro  → cinza  ("N dias para o vencimento do prazo"),
  //    mas VERMELHO se houve reprogramação — o prazo original já estourou.
  //  · em aberto, previsto vencido e AINDA sem reprogramação
  //                               → vermelho ("Necessário reprogramar")
  //  · em aberto, reprogramado também vencido
  //                               → vermelho ("Atraso de N dias")
  const reprogramado = !!parseISO(it.prazoReprogramado);
  let desvio = "—";
  let desvioTom: Tom = "cinza";
  // Base do desvio de entrega: o previsto original (cai no alvo se não houver).
  const baseEntrega = parseISO(it.prazoPrevisto) ?? alvo;
  if (real && baseEntrega) {
    const d = diffDias(real, baseEntrega);
    if (d > 0) {
      // Âmbar, não vermelho: já foi entregue — é atenção, não pendência.
      desvio = textoAtraso(d, "Finalizado com ");
      desvioTom = "ambar";
    } else {
      desvio = "Finalizado no prazo";
      desvioTom = "verde";
    }
  } else if (alvo && it.status !== "finalizado") {
    const d = diffDias(hoje, alvo);
    if (d > 0) {
      desvio = reprogramado ? `Atraso de ${d} ${d === 1 ? "dia" : "dias"}` : "Necessário reprogramar";
      desvioTom = "vermelho";
    } else {
      desvio = textoAVencer(-d);
      desvioTom = reprogramado ? "vermelho" : "cinza";
    }
  }

  return { tom, rotulo, atrasado: tom === "vermelho", desvio, desvioTom };
}
