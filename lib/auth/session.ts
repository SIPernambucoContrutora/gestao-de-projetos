import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usuariosPapel } from "@/db/schema";
import type { PapelUsuario } from "@/db/schema";
import { auth } from "./server";

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export type UsuarioComPapel = {
  user: SessionUser;
  papel: PapelUsuario;
};

/** Erro lançado quando falta autenticação ou permissão. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: "UNAUTHENTICATED" | "FORBIDDEN",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Usuário autenticado atual, ou null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const { data } = await auth.getSession();
  if (!data?.user) return null;
  return data.user as SessionUser;
}

/**
 * Usuário atual + papel resolvido a partir de usuarios_papel.
 * Least privilege: quem não tem linha na tabela é tratado como 'leitura'.
 */
export async function getCurrentUserWithRole(): Promise<UsuarioComPapel | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const [row] = await db
    .select({ papel: usuariosPapel.papel })
    .from(usuariosPapel)
    .where(eq(usuariosPapel.usuarioId, user.id))
    .limit(1);

  return { user, papel: row?.papel ?? "leitura" };
}

/** Exige autenticação. Lança AuthError se anônimo. */
export async function requireUser(): Promise<UsuarioComPapel> {
  const ctx = await getCurrentUserWithRole();
  if (!ctx) throw new AuthError("Não autenticado.", "UNAUTHENTICATED");
  return ctx;
}

/**
 * Exige permissão de escrita (admin ou equipe). 'leitura' é bloqueado.
 * Retorna o contexto para as actions gravarem histórico com o usuario_id.
 */
export async function requireEscrita(): Promise<UsuarioComPapel> {
  const ctx = await requireUser();
  if (ctx.papel !== "admin" && ctx.papel !== "equipe") {
    throw new AuthError("Seu papel (leitura) não permite esta ação.", "FORBIDDEN");
  }
  return ctx;
}

/** Exige papel admin (ex.: gerir papéis de outros usuários). */
export async function requireAdmin(): Promise<UsuarioComPapel> {
  const ctx = await requireUser();
  if (ctx.papel !== "admin") {
    throw new AuthError("Apenas admin pode executar esta ação.", "FORBIDDEN");
  }
  return ctx;
}
