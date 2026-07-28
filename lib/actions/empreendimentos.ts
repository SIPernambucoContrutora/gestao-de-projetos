"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { empreendimentos, historicoAlteracoes, itensProjeto } from "@/db/schema";
import type { Empreendimento } from "@/db/schema";
import { requireEscrita, requireUser } from "@/lib/auth/session";

/** Normaliza um valor para comparação/armazenamento como texto. */
function toText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

export type EmpreendimentoInput = {
  nome: string;
  responsavel?: string | null;
  revisaoAtual?: string;
  dataRevisao?: string | null; // 'YYYY-MM-DD'
};

export type EmpreendimentoComProgresso = Empreendimento & {
  totalItens: number;
  itensFinalizados: number;
  itensEmAndamento: number; // em andamento e dentro do prazo
  itensAtrasados: number; // não finalizado e com prazo vencido
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
      // "Atrasado" = não finalizado e com o prazo vigente (reprogramado, ou
      // previsto) já vencido. Mesma regra do derivarStatus() do frontend.
      itensAtrasados: sql<number>`count(*) filter (
        where ${itensProjeto.status} <> 'finalizado'
          and coalesce(${itensProjeto.prazoReprogramado}, ${itensProjeto.prazoPrevisto}) < current_date
      )`.mapWith(Number),
      // "Em andamento" que ainda não estourou o prazo (atraso tem precedência).
      itensEmAndamento: sql<number>`count(*) filter (
        where ${itensProjeto.status} = 'em_andamento'
          and (
            coalesce(${itensProjeto.prazoReprogramado}, ${itensProjeto.prazoPrevisto}) is null
            or coalesce(${itensProjeto.prazoReprogramado}, ${itensProjeto.prazoPrevisto}) >= current_date
          )
      )`.mapWith(Number),
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

/** Um empreendimento com progresso/contagens, ou null se não existir. */
export async function getEmpreendimento(
  id: string,
): Promise<EmpreendimentoComProgresso | null> {
  await requireUser();

  const [r] = await db
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
      itensAtrasados: sql<number>`count(*) filter (
        where ${itensProjeto.status} <> 'finalizado'
          and coalesce(${itensProjeto.prazoReprogramado}, ${itensProjeto.prazoPrevisto}) < current_date
      )`.mapWith(Number),
      itensEmAndamento: sql<number>`count(*) filter (
        where ${itensProjeto.status} = 'em_andamento'
          and (
            coalesce(${itensProjeto.prazoReprogramado}, ${itensProjeto.prazoPrevisto}) is null
            or coalesce(${itensProjeto.prazoReprogramado}, ${itensProjeto.prazoPrevisto}) >= current_date
          )
      )`.mapWith(Number),
    })
    .from(empreendimentos)
    .leftJoin(itensProjeto, eq(itensProjeto.empreendimentoId, empreendimentos.id))
    .where(eq(empreendimentos.id, id))
    .groupBy(empreendimentos.id);

  if (!r) return null;
  return {
    ...r,
    progresso: r.totalItens > 0 ? Math.round((r.itensFinalizados / r.totalItens) * 100) : 0,
  };
}

export async function createEmpreendimento(input: EmpreendimentoInput): Promise<Empreendimento> {
  const { user } = await requireEscrita();

  const nome = input.nome?.trim();
  if (!nome) throw new Error("Nome do empreendimento é obrigatório.");

  const novoId = crypto.randomUUID();

  const [inseridos] = await db.batch([
    db
      .insert(empreendimentos)
      .values({
        id: novoId,
        nome,
        responsavel: input.responsavel ?? null,
        revisaoAtual: input.revisaoAtual?.trim() || "R00",
        dataRevisao: input.dataRevisao ?? null,
      })
      .returning(),
    db.insert(historicoAlteracoes).values({
      empreendimentoId: novoId,
      acao: "criacao",
      usuarioId: user.id,
      valorNovo: nome,
      empreendimentoNome: nome,
    }),
  ]);

  revalidatePath("/empreendimentos");
  return inseridos[0];
}

// Campos editáveis + rótulo usado no histórico.
const CAMPOS_EMP = {
  nome: "nome",
  responsavel: "responsavel",
  revisaoAtual: "revisao_atual",
  dataRevisao: "data_revisao",
} as const;
type CampoEmp = keyof typeof CAMPOS_EMP;

export async function updateEmpreendimento(
  id: string,
  patch: Partial<EmpreendimentoInput>,
): Promise<Empreendimento> {
  const { user } = await requireEscrita();

  // Normaliza os valores presentes no patch.
  const novos: Partial<Record<CampoEmp, string | null>> = {};
  if (patch.nome !== undefined) {
    const nome = patch.nome?.trim();
    if (!nome) throw new Error("Nome do empreendimento não pode ser vazio.");
    novos.nome = nome;
  }
  if (patch.responsavel !== undefined) novos.responsavel = patch.responsavel ?? null;
  if (patch.revisaoAtual !== undefined) novos.revisaoAtual = patch.revisaoAtual?.trim() || "R00";
  if (patch.dataRevisao !== undefined) novos.dataRevisao = patch.dataRevisao ?? null;

  if (Object.keys(novos).length === 0) throw new Error("Nada para atualizar.");

  const [atual] = await db
    .select()
    .from(empreendimentos)
    .where(eq(empreendimentos.id, id))
    .limit(1);
  if (!atual) throw new Error("Empreendimento não encontrado.");

  const updateValues: Record<string, unknown> = {};
  const diffs: { campo: string; valorAntigo: string | null; valorNovo: string | null }[] = [];

  for (const key of Object.keys(novos) as CampoEmp[]) {
    const novo = novos[key] ?? null;
    const antigo = (atual as Record<string, unknown>)[key];
    if (toText(antigo) === toText(novo)) continue;
    updateValues[key] = novo;
    diffs.push({ campo: CAMPOS_EMP[key], valorAntigo: toText(antigo), valorNovo: toText(novo) });
  }

  if (diffs.length === 0) return atual; // nada mudou

  const [atualizados] = await db.batch([
    db.update(empreendimentos).set(updateValues).where(eq(empreendimentos.id, id)).returning(),
    db.insert(historicoAlteracoes).values(
      diffs.map((d) => ({
        empreendimentoId: id,
        acao: "edicao" as const,
        usuarioId: user.id,
        campo: d.campo,
        valorAntigo: d.valorAntigo,
        valorNovo: d.valorNovo,
        empreendimentoNome: atual.nome,
      })),
    ),
  ]);

  revalidatePath("/empreendimentos");
  revalidatePath(`/empreendimentos/${id}`);
  return atualizados[0];
}

export async function deleteEmpreendimento(id: string): Promise<{ id: string }> {
  const { user } = await requireEscrita();

  const [alvo] = await db
    .select({ nome: empreendimentos.nome })
    .from(empreendimentos)
    .where(eq(empreendimentos.id, id))
    .limit(1);

  if (!alvo) throw new Error("Empreendimento não encontrado.");

  // Registra a exclusão e apaga o empreendimento no mesmo batch. Os itens caem
  // por cascata (empreendimento→item), mas o histórico NÃO cai: as FKs do log
  // estão em SET NULL, então os registros passados sobrevivem (com o contexto
  // preservado nas colunas *_nome). Este log de exclusão também sobrevive.
  await db.batch([
    db.insert(historicoAlteracoes).values({
      empreendimentoId: id,
      acao: "exclusao",
      usuarioId: user.id,
      campo: "empreendimento",
      valorAntigo: alvo.nome,
      empreendimentoNome: alvo.nome,
    }),
    db.delete(empreendimentos).where(eq(empreendimentos.id, id)),
  ]);

  revalidatePath("/empreendimentos");
  return { id };
}
