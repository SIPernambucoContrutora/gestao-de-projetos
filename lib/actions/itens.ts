"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, getTxDb } from "@/db";
import {
  disciplinas,
  etapas,
  historicoAlteracoes,
  itensProjeto,
} from "@/db/schema";
import type { ItemProjeto, StatusItem } from "@/db/schema";
import { requireEscrita, requireUser } from "@/lib/auth/session";

/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

export type ItemInput = {
  empreendimentoId: string;
  item?: number | null;
  disciplinaId: string;
  etapaId: string;
  planta?: string | null;
  status?: StatusItem;
  dataInicio?: string | null; // 'YYYY-MM-DD'
  prazoPrevisto?: string | null;
  prazoReprogramado?: string | null;
  prazoRealizado?: string | null;
  metaDias?: string | null; // "D+30"
  observacoes?: string | null;
};

// Campos editáveis por updateItem (id e empreendimentoId não mudam por aqui).
// A ordem/label é usada tanto para o UPDATE quanto para o histórico.
const CAMPOS_EDITAVEIS = {
  item: "item",
  disciplinaId: "disciplina",
  etapaId: "etapa",
  planta: "planta",
  status: "status",
  dataInicio: "data_inicio",
  prazoPrevisto: "prazo_previsto",
  prazoReprogramado: "prazo_reprogramado",
  prazoRealizado: "prazo_realizado",
  metaDias: "meta_dias",
  observacoes: "observacoes",
} as const;

type CampoEditavel = keyof typeof CAMPOS_EDITAVEIS;

export type ItemFiltros = {
  disciplinaId?: string;
  etapaId?: string;
  status?: StatusItem;
};

export type ItemComRefs = ItemProjeto & {
  disciplinaNome: string;
  etapaNome: string;
};

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */

/**
 * Lista itens de um empreendimento, com nomes de disciplina/etapa,
 * e filtros opcionais por disciplina, etapa e status.
 */
export async function listItensPorEmpreendimento(
  empreendimentoId: string,
  filtros: ItemFiltros = {},
): Promise<ItemComRefs[]> {
  await requireUser();

  const conds = [eq(itensProjeto.empreendimentoId, empreendimentoId)];
  if (filtros.disciplinaId) conds.push(eq(itensProjeto.disciplinaId, filtros.disciplinaId));
  if (filtros.etapaId) conds.push(eq(itensProjeto.etapaId, filtros.etapaId));
  if (filtros.status) conds.push(eq(itensProjeto.status, filtros.status));

  const rows = await db
    .select({
      item: itensProjeto,
      disciplinaNome: disciplinas.nome,
      etapaNome: etapas.nome,
    })
    .from(itensProjeto)
    .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
    .innerJoin(etapas, eq(etapas.id, itensProjeto.etapaId))
    .where(and(...conds))
    .orderBy(itensProjeto.item);

  return rows.map((r) => ({ ...r.item, disciplinaNome: r.disciplinaNome, etapaNome: r.etapaNome }));
}

/* ------------------------------------------------------------------ *
 * Escrita
 * ------------------------------------------------------------------ */

export async function createItem(input: ItemInput): Promise<ItemProjeto> {
  await requireEscrita();

  if (!input.empreendimentoId) throw new Error("empreendimentoId é obrigatório.");
  if (!input.disciplinaId) throw new Error("disciplinaId é obrigatório.");
  if (!input.etapaId) throw new Error("etapaId é obrigatório.");

  const [row] = await db
    .insert(itensProjeto)
    .values({
      empreendimentoId: input.empreendimentoId,
      item: input.item ?? null,
      disciplinaId: input.disciplinaId,
      etapaId: input.etapaId,
      planta: input.planta ?? null,
      status: input.status ?? "pendente",
      dataInicio: input.dataInicio ?? null,
      prazoPrevisto: input.prazoPrevisto ?? null,
      prazoReprogramado: input.prazoReprogramado ?? null,
      prazoRealizado: input.prazoRealizado ?? null,
      metaDias: input.metaDias ?? null,
      observacoes: input.observacoes ?? null,
    })
    .returning();

  revalidatePath(`/empreendimentos/${input.empreendimentoId}`);
  return row;
}

/** Normaliza um valor de campo para comparação/armazenamento como texto. */
function toText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

/**
 * Atualiza um item e grava, ATOMICAMENTE, uma linha em historico_alteracoes
 * para cada campo que mudou (com o usuario_id da sessão).
 * Só compara os campos presentes em `patch`.
 */
export async function updateItem(
  id: string,
  patch: Partial<Omit<ItemInput, "empreendimentoId">>,
): Promise<ItemProjeto> {
  const { user } = await requireEscrita();

  const { database, pool } = getTxDb();
  try {
    return await database.transaction(async (tx) => {
      const [atual] = await tx
        .select()
        .from(itensProjeto)
        .where(eq(itensProjeto.id, id))
        .limit(1);

      if (!atual) throw new Error("Item não encontrado.");

      const updateValues: Record<string, unknown> = {};
      const diffs: {
        campo: string;
        valorAntigo: string | null;
        valorNovo: string | null;
      }[] = [];

      for (const key of Object.keys(patch) as CampoEditavel[]) {
        if (!(key in CAMPOS_EDITAVEIS)) continue; // ignora chaves não editáveis
        const novo = patch[key] as unknown;
        const antigo = (atual as Record<string, unknown>)[key];

        if (toText(antigo) === toText(novo)) continue; // sem mudança

        updateValues[key] = novo ?? null;
        diffs.push({
          campo: CAMPOS_EDITAVEIS[key],
          valorAntigo: toText(antigo),
          valorNovo: toText(novo),
        });
      }

      if (diffs.length === 0) return atual; // nada mudou, nada a registrar

      const [row] = await tx
        .update(itensProjeto)
        .set(updateValues)
        .where(eq(itensProjeto.id, id))
        .returning();

      await tx.insert(historicoAlteracoes).values(
        diffs.map((d) => ({
          itemId: id,
          usuarioId: user.id,
          campo: d.campo,
          valorAntigo: d.valorAntigo,
          valorNovo: d.valorNovo,
        })),
      );

      revalidatePath(`/empreendimentos/${row.empreendimentoId}`);
      return row;
    });
  } finally {
    await pool.end();
  }
}

export async function deleteItem(id: string): Promise<{ id: string }> {
  await requireEscrita();

  const [row] = await db
    .delete(itensProjeto)
    .where(eq(itensProjeto.id, id))
    .returning({ id: itensProjeto.id, empreendimentoId: itensProjeto.empreendimentoId });

  if (!row) throw new Error("Item não encontrado.");
  revalidatePath(`/empreendimentos/${row.empreendimentoId}`);
  return { id: row.id };
}
