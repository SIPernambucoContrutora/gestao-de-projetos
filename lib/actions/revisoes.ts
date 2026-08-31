"use server";

import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  disciplinas,
  empreendimentos,
  historicoAlteracoes,
  itensProjeto,
  projetistas,
  revisoesItem,
} from "@/db/schema";
import type { RevisaoItem } from "@/db/schema";
import { requireEscrita, requireUser } from "@/lib/auth/session";
import { hojeISORecife, rotuloRevisao } from "@/lib/ui/status";

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */

/**
 * Revisões de um item, da mais recente para a mais antiga — é o que alimenta
 * o "Histórico de revisões" do drawer.
 */
export async function listRevisoesPorItem(itemId: string): Promise<RevisaoItem[]> {
  await requireUser();

  return db
    .select()
    .from(revisoesItem)
    .where(eq(revisoesItem.itemId, itemId))
    .orderBy(desc(revisoesItem.numero));
}

/* ------------------------------------------------------------------ *
 * Escrita
 * ------------------------------------------------------------------ */

/**
 * Abre uma nova revisão de um item FINALIZADO.
 *
 * O item volta para o começo do ciclo com o projetista:
 *  · todas as datas são zeradas, e a data de início vira HOJE — a revisão é
 *    um novo ciclo de trabalho, medido a partir daqui;
 *  · o Autodoc é desmarcado (o documento que estava lá será substituído);
 *  · o status volta a 'pendente' (não há previsto ainda), mas o badge diz
 *    "Em andamento (Revisão)" por causa de em_revisao — ver derivarStatus.
 *
 * O NÚMERO da revisão (revisao_atual) NÃO muda aqui: ele conta revisões
 * ENTREGUES, então só avança quando esta revisão for ao Autodoc
 * (ver fecharRevisaoAberta, chamado por updateItem).
 */
export async function abrirRevisao(itemId: string, solicitacao: string): Promise<RevisaoItem> {
  const { user } = await requireEscrita();

  const texto = solicitacao.trim();
  if (!texto) throw new Error("Descreva a solicitação da revisão.");

  const [atual] = await db
    .select({
      item: itensProjeto,
      empNome: empreendimentos.nome,
      discNome: disciplinas.nome,
      projetistaNome: projetistas.nome,
      projetistaEmail: projetistas.email,
    })
    .from(itensProjeto)
    .innerJoin(empreendimentos, eq(empreendimentos.id, itensProjeto.empreendimentoId))
    .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
    .leftJoin(projetistas, eq(projetistas.id, itensProjeto.projetistaId))
    .where(eq(itensProjeto.id, itemId))
    .limit(1);

  if (!atual) throw new Error("Item não encontrado.");
  const item = atual.item;

  // Revisar é reabrir algo que já foi entregue: só faz sentido a partir do
  // item finalizado (a UI também esconde o botão fora dessa situação).
  if (item.status !== "finalizado") {
    throw new Error("Só é possível abrir uma revisão de um item Finalizado.");
  }
  if (item.emRevisao) {
    throw new Error("Este item já tem uma revisão em aberto.");
  }

  const hoje = hojeISORecife();

  // Ordinal da revisão dentro do item. O índice único (item_id, numero)
  // barra a corrida de dois pedidos simultâneos.
  const [{ max }] = await db
    .select({ max: sql<number | null>`max(${revisoesItem.numero})` })
    .from(revisoesItem)
    .where(eq(revisoesItem.itemId, itemId));
  const numero = (max ?? 0) + 1;

  const novoId = crypto.randomUUID();

  // O que muda no item ao entrar em revisão — o mesmo conjunto vira as
  // linhas de histórico abaixo, para o log contar a história completa.
  const zerado = {
    status: "pendente" as const,
    emRevisao: true,
    // Ciclo novo: a marca de ajustes da análise anterior não vale mais.
    ajustesPosAnalise: false,
    usuarioAnaliseId: null,
    dataInicio: hoje,
    prazoPrevisto: null,
    prazoReprogramado: null,
    prazoRealizado: null,
    enviadoAutodoc: false,
  };

  const contexto = {
    itemId,
    empreendimentoId: item.empreendimentoId,
    acao: "edicao" as const,
    usuarioId: user.id,
    empreendimentoNome: atual.empNome,
    itemNumero: item.item,
    disciplinaNome: atual.discNome,
  };

  const diffs: { campo: string; valorAntigo: string | null; valorNovo: string | null }[] = [
    {
      campo: "revisao_solicitada",
      valorAntigo: null,
      valorNovo: `${rotuloRevisao(numero)} — ${texto}`,
    },
    { campo: "status", valorAntigo: item.status, valorNovo: zerado.status },
    { campo: "data_inicio", valorAntigo: item.dataInicio, valorNovo: hoje },
  ];
  // Só registra o que de fato tinha valor antes — evita poluir o histórico
  // com "— → —" para prazos que já estavam vazios.
  if (item.prazoPrevisto) diffs.push({ campo: "prazo_previsto", valorAntigo: item.prazoPrevisto, valorNovo: null });
  if (item.prazoReprogramado) diffs.push({ campo: "prazo_reprogramado", valorAntigo: item.prazoReprogramado, valorNovo: null });
  if (item.prazoRealizado) diffs.push({ campo: "prazo_realizado", valorAntigo: item.prazoRealizado, valorNovo: null });
  if (item.enviadoAutodoc) diffs.push({ campo: "enviado_autodoc", valorAntigo: "Sim", valorNovo: "Não" });

  // Atômico num round-trip: a revisão, o item zerado e o histórico entram
  // juntos ou nada entra (mesma razão do batch em updateItem).
  const [inseridas] = await db.batch([
    db
      .insert(revisoesItem)
      .values({
        id: novoId,
        itemId,
        numero,
        solicitacao: texto,
        projetistaId: item.projetistaId,
        // Congelados: a solicitação vale para quem era o projetista HOJE.
        projetistaNome: atual.projetistaNome,
        projetistaEmail: atual.projetistaEmail,
        usuarioId: user.id,
        solicitadaEm: hoje,
      })
      .returning(),
    db.update(itensProjeto).set(zerado).where(eq(itensProjeto.id, itemId)),
    db.insert(historicoAlteracoes).values(diffs.map((d) => ({ ...contexto, ...d }))),
  ]);

  revalidatePath(`/empreendimentos/${item.empreendimentoId}`);
  return inseridas[0];
}
