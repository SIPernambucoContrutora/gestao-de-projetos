import type { StatusItem } from "@/db/schema";

/* ------------------------------------------------------------------ *
 * Derivação visual do status — porta a lógica `derive()` do protótipo.
 * A cor NUNCA é escolhida à mão: é derivada de (status + prazos + hoje).
 * Usado no servidor e no cliente, então é puro (sem I/O).
 * ------------------------------------------------------------------ */

export type Tom = "verde" | "ambar" | "vermelho" | "cinza";

export const ROTULO_STATUS: Record<StatusItem, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  finalizado: "Finalizado",
};

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
};

export type StatusDerivado = {
  tom: Tom;
  rotulo: string;
  atrasado: boolean;
  desvio: string; // "+3d" | "-2d" | "no prazo" | "—"
};

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
  } else if (alvo && alvo < hoje) {
    tom = "vermelho";
    rotulo = "Atrasado";
  } else if (it.status === "em_andamento") {
    tom = "ambar";
  }

  let desvio = "—";
  if (real && alvo) {
    const d = diffDias(real, alvo);
    desvio = d === 0 ? "no prazo" : d > 0 ? `+${d}d` : `${d}d`;
  } else if (alvo && it.status !== "finalizado") {
    const d = diffDias(hoje, alvo);
    desvio = d > 0 ? `+${d}d` : `${d}d`;
  }

  return { tom, rotulo, atrasado: tom === "vermelho", desvio };
}
