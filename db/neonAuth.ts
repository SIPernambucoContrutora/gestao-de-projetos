import { pgSchema, text, uuid } from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ *
 * Espelho (read-only) da tabela de usuários gerenciada pelo Neon Auth.
 *
 * NÃO faz parte das nossas migrations — o schema `neon_auth` é criado e
 * mantido pelo Neon Auth (managed/beta). Declaramos só as colunas que
 * consumimos, para poder fazer join tipado com `usuarios_papel`.
 * Nunca escrever aqui.
 * ------------------------------------------------------------------ */

export const neonAuth = pgSchema("neon_auth");

// id é uuid no banco; usuarios_papel.usuario_id é text (id da sessão como
// string) — o join precisa castar (ver lib/actions/usuarios.ts).
export const neonAuthUser = neonAuth.table("user", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  name: text("name"),
});
