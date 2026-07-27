"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { historicoAlteracoes } from "@/db/schema";
import type { HistoricoAlteracao } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

/** Histórico de alterações de um item, mais recente primeiro. */
export async function listHistoricoPorItem(itemId: string): Promise<HistoricoAlteracao[]> {
  await requireUser();

  return db
    .select()
    .from(historicoAlteracoes)
    .where(eq(historicoAlteracoes.itemId, itemId))
    .orderBy(desc(historicoAlteracoes.createdAt));
}
