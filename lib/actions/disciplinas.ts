"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { disciplinas } from "@/db/schema";
import type { CategoriaDisciplina, Disciplina } from "@/db/schema";
import { requireEscrita, requireUser } from "@/lib/auth/session";

export type DisciplinaInput = {
  nome: string;
  categoria: CategoriaDisciplina | null;
};

/** Disciplinas cadastradas, em ordem alfabética. */
export async function listDisciplinasAdmin(): Promise<Disciplina[]> {
  await requireUser();
  return db.select().from(disciplinas).orderBy(asc(disciplinas.nome));
}

export async function createDisciplina(input: DisciplinaInput): Promise<Disciplina> {
  await requireEscrita();

  const nome = input.nome?.trim();
  if (!nome) throw new Error("Nome da disciplina é obrigatório.");

  const [inserida] = await db
    .insert(disciplinas)
    .values({ nome, categoria: input.categoria })
    .returning();

  revalidatePath("/disciplinas");
  return inserida;
}

export async function updateDisciplina(
  id: string,
  patch: Partial<DisciplinaInput>,
): Promise<Disciplina> {
  await requireEscrita();

  const updateValues: Record<string, unknown> = {};
  if (patch.nome !== undefined) {
    const nome = patch.nome?.trim();
    if (!nome) throw new Error("Nome da disciplina não pode ser vazio.");
    updateValues.nome = nome;
  }
  if (patch.categoria !== undefined) updateValues.categoria = patch.categoria;

  if (Object.keys(updateValues).length === 0) throw new Error("Nada para atualizar.");

  const [atualizada] = await db
    .update(disciplinas)
    .set(updateValues)
    .where(eq(disciplinas.id, id))
    .returning();

  if (!atualizada) throw new Error("Disciplina não encontrada.");

  revalidatePath("/disciplinas");
  return atualizada;
}

export async function deleteDisciplina(id: string): Promise<{ id: string }> {
  await requireEscrita();

  try {
    await db.delete(disciplinas).where(eq(disciplinas.id, id));
  } catch {
    // FK restrict: existem itens de projeto usando esta disciplina.
    throw new Error("Esta disciplina está em uso em itens de projeto e não pode ser excluída.");
  }

  revalidatePath("/disciplinas");
  return { id };
}
