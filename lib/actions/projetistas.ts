"use server";

import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { disciplinas, empreendimentos, etapas, itensProjeto, projetistas } from "@/db/schema";
import type { Projetista, StatusItem } from "@/db/schema";
import { requireEscrita, requireUser } from "@/lib/auth/session";

export type ProjetistaInput = {
  nome: string;
  telefone?: string | null;
  email?: string | null;
};

/** Uma linha do histórico de desempenho: um item que o projetista assumiu. */
export type DesempenhoProjetista = {
  id: string;
  empreendimentoId: string;
  empreendimentoNome: string;
  disciplinaNome: string;
  etapaNome: string;
  planta: string | null;
  item: number | null;
  status: StatusItem;
  dataInicio: string | null;
  prazoPrevisto: string | null;
  prazoReprogramado: string | null;
  prazoRealizado: string | null;
};

/**
 * Itens já atribuídos ao projetista, para avaliar desempenho passado.
 * O desvio não é gravado: é derivado dos prazos na UI (`derivarStatus`),
 * mantendo uma única fonte de verdade para a regra.
 */
export async function listDesempenhoProjetista(
  projetistaId: string,
): Promise<DesempenhoProjetista[]> {
  await requireUser();

  const rows = await db
    .select({
      id: itensProjeto.id,
      empreendimentoId: itensProjeto.empreendimentoId,
      empreendimentoNome: empreendimentos.nome,
      disciplinaNome: disciplinas.nome,
      etapaNome: etapas.nome,
      planta: itensProjeto.planta,
      item: itensProjeto.item,
      status: itensProjeto.status,
      dataInicio: itensProjeto.dataInicio,
      prazoPrevisto: itensProjeto.prazoPrevisto,
      prazoReprogramado: itensProjeto.prazoReprogramado,
      prazoRealizado: itensProjeto.prazoRealizado,
    })
    .from(itensProjeto)
    .innerJoin(empreendimentos, eq(empreendimentos.id, itensProjeto.empreendimentoId))
    .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
    .innerJoin(etapas, eq(etapas.id, itensProjeto.etapaId))
    .where(eq(itensProjeto.projetistaId, projetistaId))
    .orderBy(
      asc(empreendimentos.nome),
      sql`coalesce(${itensProjeto.prazoReprogramado}, ${itensProjeto.prazoPrevisto}) asc nulls last`,
    );

  return rows;
}

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
