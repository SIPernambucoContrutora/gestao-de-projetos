/**
 * Máscara de telefone no formato (DDD)xxxxx-xxxx.
 *
 * Só os dígitos são guardados/derivados: o que o usuário digitar (espaços,
 * traços, parênteses vindos de um colar) é descartado antes de remontar a
 * máscara. Números com 10 dígitos (fixo) saem como (DDD)xxxx-xxxx.
 */

/** Mantém apenas dígitos, no máximo 11 (DDD + 9 do celular). */
function digitos(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 11);
}

/**
 * Formata progressivamente, para uso no onChange do input: aceita valores
 * incompletos e só acrescenta separador quando já há dígito para ele.
 */
export function formatTelefone(valor: string): string {
  const d = digitos(valor);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  // Corte do traço: 5 dígitos no celular (11 no total), 4 no fixo.
  const corte = d.length > 10 ? 5 : 4;
  if (resto.length <= corte) return `(${ddd})${resto}`;
  return `(${ddd})${resto.slice(0, corte)}-${resto.slice(corte)}`;
}
