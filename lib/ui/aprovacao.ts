import type { FaseEmpreendimento } from "@/db/schema";

/* ------------------------------------------------------------------ *
 * Aprovação do empreendimento na Prefeitura. Puro (sem I/O): usado
 * pela Server Action, pelas telas e pela varredura do cron.
 * ------------------------------------------------------------------ */

export const MESES_VALIDADE_APROVACAO = 12;
export const MESES_AVISO_APROVACAO = 10;

/** "Em estudo" ainda não foi aprovado; toda fase depois dela já passou pela aprovação. */
export function faseTemAprovacao(fase: FaseEmpreendimento | "" | null | undefined): boolean {
  return !!fase && fase !== "em_estudo";
}

/**
 * Soma meses a uma data 'YYYY-MM-DD'. O dia é limitado ao último do mês de
 * destino (31/03 + 1 mês → 30/04; 29/02 + 12 meses → 28/02), a mesma regra
 * do `date + interval` do Postgres.
 */
export function somarMesesISO(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(y, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + meses, Math.min(d, ultimoDia))).toISOString().slice(0, 10);
}

/** Dias corridos de `de` até `ate` (ambos 'YYYY-MM-DD'); negativo se `ate` já passou. */
export function diasEntreISO(de: string, ate: string): number {
  const utc = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(ate) - utc(de)) / 86_400_000);
}

export function vencimentoAprovacao(dataAprovacao: string): string {
  return somarMesesISO(dataAprovacao, MESES_VALIDADE_APROVACAO);
}

/** A partir de quando o aviso de vencimento deve sair. */
export function inicioAvisoAprovacao(dataAprovacao: string): string {
  return somarMesesISO(dataAprovacao, MESES_AVISO_APROVACAO);
}
