"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { projetistas } from "@/db/schema";
import type { Projetista } from "@/db/schema";
import { requireEscrita, requireUser } from "@/lib/auth/session";

export type ProjetistaInput = {
  nome: string;
  telefone?: string | null;
  email?: string | null;
};

/** Projetistas cadastrados, em ordem alfabética. */
export async function listProjetistas(): Promise<Projetista[]> {
  await requireUser();
  return db.select().from(projetistas).orderBy(asc(projetistas.nome));
}

export async function createProjetista(input: ProjetistaInput): Promise<Projetista> {
  await requireEscrita();

  const nome = input.nome?.trim();
  if (!nome) throw new Error("Nome do projetista é obrigatório.");

  const [inserido] = await db
    .insert(projetistas)
    .values({
      nome,
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim() || null,
    })
    .returning();

  revalidatePath("/projetistas");
  return inserido;
}

export async function updateProjetista(
  id: string,
  patch: Partial<ProjetistaInput>,
): Promise<Projetista> {
  await requireEscrita();

  const updateValues: Record<string, unknown> = {};
  if (patch.nome !== undefined) {
    const nome = patch.nome?.trim();
    if (!nome) throw new Error("Nome do projetista não pode ser vazio.");
    updateValues.nome = nome;
  }
  if (patch.telefone !== undefined) updateValues.telefone = patch.telefone?.trim() || null;
  if (patch.email !== undefined) updateValues.email = patch.email?.trim() || null;

  if (Object.keys(updateValues).length === 0) throw new Error("Nada para atualizar.");

  const [atualizado] = await db
    .update(projetistas)
    .set(updateValues)
    .where(eq(projetistas.id, id))
    .returning();

  if (!atualizado) throw new Error("Projetista não encontrado.");

  revalidatePath("/projetistas");
  return atualizado;
}

export async function deleteProjetista(id: string): Promise<{ id: string }> {
  await requireEscrita();

  await db.delete(projetistas).where(eq(projetistas.id, id));

  revalidatePath("/projetistas");
  return { id };
}
