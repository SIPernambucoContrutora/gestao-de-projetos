/* ------------------------------------------------------------------ *
 * Paleta e formatadores dos gráficos (tela de Indicadores).
 *
 * A cor de um gráfico NUNCA é escolhida à mão aqui — cada família abaixo
 * tem um trabalho:
 *
 *   TOM_GRAFICO  · estado (status do item). Espelha os tons de
 *     lib/ui/status.ts para o gráfico e o badge contarem a mesma história.
 *   SERIES       · identidade (disciplina, etapa, tipo…). Ordem FIXA, nunca
 *     ciclada: a 9ª série vira "Outras", não uma cor inventada.
 *   RAMPA_*      · magnitude (heatmaps). Uma única matiz, claro → escuro.
 *
 * As matizes de estado foram validadas contra o fundo branco dos painéis
 * (contraste ≥ 3:1, separação para daltonismo ≥ 8 ΔE e ≥ 15 ΔE na visão
 * normal, em toda vizinhança usada nas pilhas). Duas notas de calibragem:
 *
 *   · o âmbar do gráfico (#c47f00) é um passo mais claro que o do badge
 *     (#b57312): lado a lado com o vermelho, o do badge ficava a 13.4 ΔE,
 *     abaixo do piso de 15 — perto demais para distinguir numa pilha;
 *   · o cinza de "pendente" (#4d8a93) fica de propósito abaixo do piso de
 *     saturação. Ali o cinza É o significado ("nada programado ainda"), e
 *     uma matiz saturada mentiria sobre isso.
 *
 * A ordem de empilhamento em ORDEM_PILHA existe pelo mesmo motivo: é a
 * única que mantém rosa e vermelho separados (12.0 ΔE quando encostam).
 * Reordenar a pilha exige revalidar as vizinhanças.
 * ------------------------------------------------------------------ */

import type { Tom } from "@/lib/ui/status";

/** Cor de cada tom de status nos gráficos. */
export const TOM_GRAFICO: Record<Tom, string> = {
  verde: "#1a7a4f",
  azul: "#1a5fb5",
  rosa: "#c4327c",
  ambar: "#c47f00",
  vermelho: "#b23a2b",
  cinza: "#4d8a93",
};

/**
 * Ordem de empilhamento dos estados (do concluído ao não iniciado). Além da
 * leitura natural, é a ordem que mantém as vizinhanças validadas.
 */
export const ORDEM_PILHA: Tom[] = ["verde", "azul", "rosa", "ambar", "vermelho", "cinza"];

/**
 * Paleta categórica (identidade). Ordem fixa — a posição da série define a
 * cor, então filtrar não repinta quem sobrou.
 */
export const SERIES = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
] as const;

/**
 * Máximo de séries em gráficos onde TODAS as cores se encostam (dispersão,
 * bolha): só as três primeiras posições se separam em todos os pares. Acima
 * disso, agrupe em "Outras" ou separe em gráficos pequenos.
 */
export const MAX_SERIES_DISPERSAO = 3;

/** Cor da série na posição i (nunca cicla: acima de 8, cinza de "Outras"). */
export function corSerie(i: number): string {
  return SERIES[i] ?? "#4d8a93";
}

/** Rampa sequencial teal — volume (quantidade de itens). */
export const RAMPA_TEAL = [
  "#e6f4f5",
  "#c2e3e6",
  "#94cdd3",
  "#61b2bb",
  "#2f96a1",
  "#0d727c",
  "#0a5760",
] as const;

/** Rampa sequencial vermelha — intensidade de atraso. */
export const RAMPA_ATRASO = [
  "#fbeae7",
  "#f4cdc6",
  "#e9aa9e",
  "#dc8374",
  "#cb6052",
  "#b23a2b",
  "#8d2b1f",
] as const;

/**
 * Passo de uma rampa para um valor normalizado (0..1). `null` devolve o
 * primeiro passo — "nada aqui" tem de parecer vazio, não pouco.
 */
export function passoRampa(rampa: readonly string[], v: number | null): string {
  if (v === null || Number.isNaN(v)) return rampa[0];
  const i = Math.min(rampa.length - 1, Math.max(0, Math.round(v * (rampa.length - 1))));
  return rampa[i];
}

/** Tinta e traços do gráfico (eixos, grade, texto). */
export const CHART = {
  grade: "#e7f3f4",
  eixo: "#d3e4e6",
  texto: "#517d83",
  textoForte: "#0e3438",
  superficie: "#ffffff",
} as const;

/* ------------------------------------------------------------------ *
 * Formatadores
 * ------------------------------------------------------------------ */

export function pct(v: number, casas = 0): string {
  return `${v.toFixed(casas).replace(".", ",")}%`;
}

/** Número com separador de milhar pt-BR. */
export function num(v: number, casas = 0): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function dias(v: number | null, casas = 0): string {
  if (v === null || Number.isNaN(v)) return "—";
  const n = num(v, casas);
  return `${n} ${Math.abs(v) === 1 ? "dia" : "dias"}`;
}

/** 'YYYY-MM-DD' → 'dd/mm'. Usado nos eixos de tempo. */
export function rotuloDiaMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** 'YYYY-MM' → 'mmm/aa'. */
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function rotuloMes(ym: string): string {
  const [a, m] = ym.split("-");
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
}

/** Trunca um rótulo de categoria para caber no eixo. */
export function curto(s: string, max = 18): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
