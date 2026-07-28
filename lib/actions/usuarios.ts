"use server";

import { asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { neonAuthUser } from "@/db/neonAuth";
import { usuariosPapel } from "@/db/schema";
import type { PapelUsuario } from "@/db/schema";
import { AuthError, requireAdmin } from "@/lib/auth/session";

export type UsuarioListado = {
  id: string;
  email: string | null;
  name: string | null;
  papel: PapelUsuario;
};

/**
 * Lista todos os usuários do Neon Auth com o papel resolvido da aplicação.
 * Quem não tem linha em usuarios_papel é 'leitura' (least privilege).
 * Somente admin.
 */
export async function listUsuarios(): Promise<UsuarioListado[]> {
  await requireAdmin();

  const rows = await db
    .select({
      id: neonAuthUser.id,
      email: neonAuthUser.email,
      name: neonAuthUser.name,
      papel: usuariosPapel.papel,
    })
    .from(neonAuthUser)
    // usuario_id é text; neon_auth.user.id é uuid → cast explícito no join.
    .leftJoin(usuariosPapel, sql`${usuariosPapel.usuarioId} = ${neonAuthUser.id}::text`)
    .orderBy(asc(neonAuthUser.email));

  return rows.map((r) => ({ ...r, papel: r.papel ?? "leitura" }));
}

/**
 * Define o papel de um usuário (upsert). Somente admin.
 * Trava de segurança: um admin não pode rebaixar a si mesmo (evita lockout).
 */
export async function setPapelUsuario(
  usuarioId: string,
  papel: PapelUsuario,
): Promise<{ usuarioId: string; papel: PapelUsuario }> {
  const { user } = await requireAdmin();

  if (usuarioId === user.id && papel !== "admin") {
    throw new AuthError("Você não pode rebaixar o seu próprio acesso de admin.", "FORBIDDEN");
  }

  await db
    .insert(usuariosPapel)
    .values({ usuarioId, papel })
    .onConflictDoUpdate({
      target: usuariosPapel.usuarioId,
      set: { papel, updatedAt: new Date() },
    });

  revalidatePath("/usuarios");
  return { usuarioId, papel };
}
