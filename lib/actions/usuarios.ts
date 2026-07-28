"use server";

import { asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
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

export type CriarUsuarioInput = {
  nome: string;
  email: string;
  senha: string;
  papel: PapelUsuario;
};

/**
 * Cria um novo usuário (com senha) e define o papel. Somente admin.
 *
 * O cadastro público está desabilitado no proxy (app/api/auth), então esta é a
 * única porta de entrada. Chama o endpoint de sign-up do Neon Auth
 * SERVER-TO-SERVER (sem os cookies do admin, encaminhando só o Origin do app),
 * de modo que a sessão de quem está criando não é alterada.
 */
export async function createUsuario(
  input: CriarUsuarioInput,
): Promise<{ id: string }> {
  await requireAdmin();

  const nome = input.nome?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!nome) throw new Error("Informe o nome do usuário.");
  if (!email) throw new Error("Informe o e-mail.");
  if (!input.senha || input.senha.length < 8) {
    throw new Error("A senha deve ter ao menos 8 caracteres.");
  }

  const base = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("NEON_AUTH_BASE_URL não configurada.");

  // O sign-up exige um Origin confiável — reutilizamos o da requisição do app
  // (o mesmo que o login já usa e o Neon Auth aceita).
  const h = await headers();
  const origin = h.get("origin") || (h.get("host") ? `https://${h.get("host")}` : null);
  if (!origin) throw new Error("Não foi possível identificar a origem da requisição.");

  const res = await fetch(`${base}/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password: input.senha, name: nome }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    user?: { id?: string };
    message?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new Error(data.message || "Falha ao criar o usuário no provedor de autenticação.");
  }
  const novoId = data.user?.id;
  if (!novoId) throw new Error("Usuário criado, mas o provedor não retornou o id.");

  // Papel da aplicação (least privilege por padrão).
  await db
    .insert(usuariosPapel)
    .values({ usuarioId: novoId, papel: input.papel })
    .onConflictDoUpdate({
      target: usuariosPapel.usuarioId,
      set: { papel: input.papel, updatedAt: new Date() },
    });

  revalidatePath("/usuarios");
  return { id: novoId };
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
