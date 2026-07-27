"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { empreendimentos, itensProjeto } from "@/db/schema";
import type { Empreendimento } from "@/db/schema";
import { requireEscrita, requireUser } from "@/lib/auth/session";

export type EmpreendimentoInput = {
  nome: string;
  responsavel?: string | null;
  revisaoAtual?: string;
  dataRevisao?: string | null; // 'YYYY-MM-DD'
};

export type EmpreendimentoComProgresso = Empreendimento & {
  totalItens: number;
  itensFinalizados: number;
  progresso: number; // 0..100
};

/**
 * Lista empreendimentos com % de progresso derivado dos itens
 * (itens finalizados / total). Leitura permitida a qualquer autenticado.
 */
export async function listEmpreendimentos(): Promise<EmpreendimentoComProgresso[]> {
  await requireUser();

  const rows = await db
    .select({
      id: empreendimentos.id,
      nome: empreendimentos.nome,
      responsavel: empreendimentos.responsavel,
      revisaoAtual: empreendimentos.revisaoAtual,
      dataRevisao: empreendimentos.dataRevisao,
      createdAt: empreendimentos.createdAt,
      totalItens: sql<number>`count(${itensProjeto.id})`.mapWith(Number),
      itensFinalizados: sql<number>`count(*) filter (where ${itensProjeto.status} = 'finalizado')`.mapWith(
        Number,
      ),
    })
    .from(empreendimentos)
    .leftJoin(itensProjeto, eq(itensProjeto.empreendimentoId, empreendimentos.id))
    .groupBy(empreendimentos.id)
    .orderBy(empreendimentos.nome);

  return rows.map((r) => ({
    ...r,
    progresso: r.totalItens > 0 ? Math.round((r.itensFinalizados / r.totalItens) * 100) : 0,
  }));
}

export async function createEmpreendimento(input: EmpreendimentoInput): Promise<Empreendimento> {
  await requireEscrita();

  const nome = input.nome?.trim();
  if (!nome) throw new Error("Nome do empreendimento é obrigatório.");

  const [row] = await db
    .insert(empreendimentos)
    .values({
      nome,
      responsavel: input.responsavel ?? null,
      revisaoAtual: input.revisaoAtual?.trim() || "R00",
      dataRevisao: input.dataRevisao ?? null,
    })
    .returning();

  revalidatePath("/empreendimentos");
  return row;
}

export async function updateEmpreendimento(
  id: string,
  patch: Partial<EmpreendimentoInput>,
): Promise<Empreendimento> {
  await requireEscrita();

  const values: Record<string, unknown> = {};
  if (patch.nome !== undefined) {
    const nome = patch.nome?.trim();
    if (!nome) throw new Error("Nome do empreendimento não pode ser vazio.");
    values.nome = nome;
  }
  if (patch.responsavel !== undefined) values.responsavel = patch.responsavel;
  if (patch.revisaoAtual !== undefined) values.revisaoAtual = patch.revisaoAtual?.trim() || "R00";
  if (patch.dataRevisao !== undefined) values.dataRevisao = patch.dataRevisao;

  if (Object.keys(values).length === 0) {
    throw new Error("Nada para atualizar.");
  }

  const [row] = await db
    .update(empreendimentos)
    .set(values)
    .where(eq(empreendimentos.id, id))
    .returning();

  if (!row) throw new Error("Empreendimento não encontrado.");
  revalidatePath("/empreendimentos");
  return row;
}

export async function deleteEmpreendimento(id: string): Promise<{ id: string }> {
  await requireEscrita();

  // ON DELETE CASCADE remove os itens (e o histórico dos itens) junto.
  const [row] = await db
    .delete(empreendimentos)
    .where(eq(empreendimentos.id, id))
    .returning({ id: empreendimentos.id });

  if (!row) throw new Error("Empreendimento não encontrado.");
  revalidatePath("/empreendimentos");
  return row;
}
