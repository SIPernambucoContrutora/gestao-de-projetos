/**
 * Máscara de CNPJ no formato 00.000.000/0000-00.
 *
 * Só os dígitos são guardados/derivados: o que o usuário digitar (espaços,
 * pontos, barra ou traço vindos de um colar) é descartado antes de remontar
 * a máscara.
 */

/** Mantém apenas dígitos, no máximo 14. */
function digitos(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 14);
}

/**
 * Formata progressivamente, para uso no onChange do input: aceita valores
 * incompletos e só acrescenta separador quando já há dígito para ele.
 */
export function formatCnpj(valor: string): string {
  const d = digitos(valor);
  if (!d) return "";
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** CNPJ completo válido no formato da máscara (14 dígitos). */
export function isCnpjCompleto(valor: string): boolean {
  return digitos(valor).length === 14;
}
