"use server";

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { neonAuthUser } from "@/db/neonAuth";
import { historicoAlteracoes } from "@/db/schema";
import type { AcaoHistorico, HistoricoAlteracao } from "@/db/schema";
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

export type HistoricoGlobal = {
  id: string;
  acao: AcaoHistorico;
  campo: string | null;
  valorAntigo: string | null;
  valorNovo: string | null;
  createdAt: Date;
  itemId: string | null;
  itemNumero: number | null;
  empreendimentoId: string | null;
  empreendimentoNome: string | null;
  disciplinaNome: string | null;
  autorNome: string | null;
  autorEmail: string | null;
};

/**
 * Histórico global (auditoria) — criações, edições e exclusões, mais recentes
 * primeiro, com autor (neon_auth.user) e contexto. Tudo em LEFT JOIN: eventos
 * de empreendimento (sem item) e de exclusão de item (item já não existe) não
 * podem derrubar a linha da auditoria.
 */
export async function listHistoricoGlobal(limite = 200): Promise<HistoricoGlobal[]> {
  await requireUser();

  // Contexto vem denormalizado do próprio log (empreendimento_nome, item_numero,
  // disciplina_nome), então sobrevive à exclusão da entidade — sem joins frágeis.
  return db
    .select({
      id: historicoAlteracoes.id,
      acao: historicoAlteracoes.acao,
      campo: historicoAlteracoes.campo,
      valorAntigo: historicoAlteracoes.valorAntigo,
      valorNovo: historicoAlteracoes.valorNovo,
      createdAt: historicoAlteracoes.createdAt,
      itemId: historicoAlteracoes.itemId,
      itemNumero: historicoAlteracoes.itemNumero,
      empreendimentoId: historicoAlteracoes.empreendimentoId,
      empreendimentoNome: historicoAlteracoes.empreendimentoNome,
      disciplinaNome: historicoAlteracoes.disciplinaNome,
      autorNome: neonAuthUser.name,
      autorEmail: neonAuthUser.email,
    })
    .from(historicoAlteracoes)
    // usuario_id é text; neon_auth.user.id é uuid → cast (ver db/neonAuth.ts).
    .leftJoin(neonAuthUser, sql`${historicoAlteracoes.usuarioId} = ${neonAuthUser.id}::text`)
    .orderBy(desc(historicoAlteracoes.createdAt))
    .limit(limite);
}
