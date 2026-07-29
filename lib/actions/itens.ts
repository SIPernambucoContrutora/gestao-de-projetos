"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  disciplinas,
  empreendimentos,
  etapas,
  historicoAlteracoes,
  itensProjeto,
  projetistas,
} from "@/db/schema";
import type { ItemProjeto, StatusItem } from "@/db/schema";
import { requireEscrita, requireUser } from "@/lib/auth/session";

/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

export type ItemInput = {
  empreendimentoId: string;
  disciplinaId: string;
  etapaId: string;
  projetistaId?: string | null;
  planta?: string | null;
  status?: StatusItem;
  dataInicio?: string | null; // 'YYYY-MM-DD'
  prazoPrevisto?: string | null;
  prazoReprogramado?: string | null;
  prazoRealizado?: string | null;
  metaDias?: string | null; // "D+30"
  observacoes?: string | null;
  revisaoAtual?: string | null; // "R00"
  dataRevisao?: string | null;
};

// Campos editáveis por updateItem (id, empreendimentoId e item — numeração
// automática — não mudam por aqui). A ordem/label é usada tanto para o
// UPDATE quanto para o histórico.
const CAMPOS_EDITAVEIS = {
  disciplinaId: "disciplina",
  etapaId: "etapa",
  projetistaId: "projetista",
  planta: "planta",
  status: "status",
  dataInicio: "data_inicio",
  prazoPrevisto: "prazo_previsto",
  prazoReprogramado: "prazo_reprogramado",
  prazoRealizado: "prazo_realizado",
  metaDias: "meta_dias",
  observacoes: "observacoes",
  revisaoAtual: "revisao_atual",
  dataRevisao: "data_revisao",
} as const;

type CampoEditavel = keyof typeof CAMPOS_EDITAVEIS;

// Campos cujo valor é um id de outra entidade — no histórico, gravamos o
// NOME da entidade referenciada, não o uuid cru.
const CAMPOS_REFERENCIA = {
  disciplinaId: disciplinas,
  etapaId: etapas,
  projetistaId: projetistas,
} as const;

export type ItemFiltros = {
  disciplinaId?: string;
  etapaId?: string;
  status?: StatusItem;
};

export type ItemComRefs = ItemProjeto & {
  disciplinaNome: string;
  etapaNome: string;
  projetistaNome: string | null;
};

export type ItemDashboard = ItemComRefs & {
  empreendimentoNome: string;
};

// Ordena pela data-alvo mais próxima da data atual: reprogramado tem
// precedência sobre previsto; itens sem nenhuma data ficam por último.
const ORDEM_DATA_ALVO = sql`coalesce(${itensProjeto.prazoReprogramado}, ${itensProjeto.prazoPrevisto}) asc nulls last`;

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */

/**
 * Lista itens de um empreendimento, com nomes de disciplina/etapa/projetista,
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
      projetistaNome: projetistas.nome,
    })
    .from(itensProjeto)
    .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
    .innerJoin(etapas, eq(etapas.id, itensProjeto.etapaId))
    .leftJoin(projetistas, eq(projetistas.id, itensProjeto.projetistaId))
    .where(and(...conds))
    .orderBy(ORDEM_DATA_ALVO);

  return rows.map((r) => ({
    ...r.item,
    disciplinaNome: r.disciplinaNome,
    etapaNome: r.etapaNome,
    projetistaNome: r.projetistaNome,
  }));
}

/** Todos os itens (todos os empreendimentos), para o dashboard consolidado. */
export async function listTodosItens(): Promise<ItemDashboard[]> {
  await requireUser();

  const rows = await db
    .select({
      item: itensProjeto,
      disciplinaNome: disciplinas.nome,
      etapaNome: etapas.nome,
      projetistaNome: projetistas.nome,
      empreendimentoNome: empreendimentos.nome,
    })
    .from(itensProjeto)
    .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
    .innerJoin(etapas, eq(etapas.id, itensProjeto.etapaId))
    .leftJoin(projetistas, eq(projetistas.id, itensProjeto.projetistaId))
    .innerJoin(empreendimentos, eq(empreendimentos.id, itensProjeto.empreendimentoId))
    .orderBy(ORDEM_DATA_ALVO);

  return rows.map((r) => ({
    ...r.item,
    disciplinaNome: r.disciplinaNome,
    etapaNome: r.etapaNome,
    projetistaNome: r.projetistaNome,
    empreendimentoNome: r.empreendimentoNome,
  }));
}

/* ------------------------------------------------------------------ *
 * Escrita
 * ------------------------------------------------------------------ */

export async function createItem(input: ItemInput): Promise<ItemProjeto> {
  const { user } = await requireEscrita();

  if (!input.empreendimentoId) throw new Error("empreendimentoId é obrigatório.");
  if (!input.disciplinaId) throw new Error("disciplinaId é obrigatório.");
  if (!input.etapaId) throw new Error("etapaId é obrigatório.");

  // Contexto para desnormalizar no histórico (sobrevive à exclusão).
  const [emp] = await db
    .select({ nome: empreendimentos.nome })
    .from(empreendimentos)
    .where(eq(empreendimentos.id, input.empreendimentoId))
    .limit(1);
  const [disc] = await db
    .select({ nome: disciplinas.nome })
    .from(disciplinas)
    .where(eq(disciplinas.id, input.disciplinaId))
    .limit(1);

  // Nº do item: incremental e automático por empreendimento (MAX + 1).
  // Sem renumeração ao excluir — exclusões podem deixar buracos na sequência.
  const [{ max }] = await db
    .select({ max: sql<number | null>`max(${itensProjeto.item})` })
    .from(itensProjeto)
    .where(eq(itensProjeto.empreendimentoId, input.empreendimentoId));
  const proximoItem = (max ?? 0) + 1;

  // id explícito para referenciar o novo item no log dentro do mesmo batch.
  const novoId = crypto.randomUUID();

  const [inseridos] = await db.batch([
    db
      .insert(itensProjeto)
      .values({
        id: novoId,
        empreendimentoId: input.empreendimentoId,
        item: proximoItem,
        disciplinaId: input.disciplinaId,
        etapaId: input.etapaId,
        projetistaId: input.projetistaId ?? null,
        planta: input.planta ?? null,
        status: input.status ?? "pendente",
        dataInicio: input.dataInicio ?? null,
        prazoPrevisto: input.prazoPrevisto ?? null,
        prazoReprogramado: input.prazoReprogramado ?? null,
        prazoRealizado: input.prazoRealizado ?? null,
        metaDias: input.metaDias ?? null,
        observacoes: input.observacoes ?? null,
        revisaoAtual: input.revisaoAtual?.trim() || "R00",
        dataRevisao: input.dataRevisao ?? null,
      })
      .returning(),
    db.insert(historicoAlteracoes).values({
      itemId: novoId,
      empreendimentoId: input.empreendimentoId,
      usuarioId: user.id,
      acao: "criacao",
      empreendimentoNome: emp?.nome ?? null,
      itemNumero: proximoItem,
      disciplinaNome: disc?.nome ?? null,
    }),
  ]);

  revalidatePath(`/empreendimentos/${input.empreendimentoId}`);
  return inseridos[0];
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

  const [atual] = await db
    .select({
      item: itensProjeto,
      empNome: empreendimentos.nome,
      discNome: disciplinas.nome,
      etapaNome: etapas.nome,
      projetistaNome: projetistas.nome,
    })
    .from(itensProjeto)
    .innerJoin(empreendimentos, eq(empreendimentos.id, itensProjeto.empreendimentoId))
    .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
    .innerJoin(etapas, eq(etapas.id, itensProjeto.etapaId))
    .leftJoin(projetistas, eq(projetistas.id, itensProjeto.projetistaId))
    .where(eq(itensProjeto.id, id))
    .limit(1);

  if (!atual) throw new Error("Item não encontrado.");
  const item = atual.item;

  // Nomes atuais das entidades referenciadas (para o "antigo" do diff).
  const nomeAtualPorCampo: Partial<Record<CampoEditavel, string | null>> = {
    disciplinaId: atual.discNome,
    etapaId: atual.etapaNome,
    projetistaId: atual.projetistaNome,
  };

  const updateValues: Record<string, unknown> = {};
  const diffs: {
    campo: string;
    valorAntigo: string | null;
    valorNovo: string | null;
  }[] = [];

  for (const key of Object.keys(patch) as CampoEditavel[]) {
    if (!(key in CAMPOS_EDITAVEIS)) continue; // ignora chaves não editáveis
    const novo = patch[key] as unknown;
    const antigo = (item as Record<string, unknown>)[key];

    if (toText(antigo) === toText(novo)) continue; // sem mudança

    updateValues[key] = novo ?? null;

    // Para campos-referência (disciplina/etapa/projetista), o histórico
    // grava o NOME, não o uuid — resolve o nome do novo valor sob demanda.
    if (key in CAMPOS_REFERENCIA) {
      let valorNovoLegivel: string | null = null;
      if (novo) {
        const tabela = CAMPOS_REFERENCIA[key as keyof typeof CAMPOS_REFERENCIA];
        const [ref] = await db
          .select({ nome: tabela.nome })
          .from(tabela)
          .where(eq(tabela.id, novo as string))
          .limit(1);
        valorNovoLegivel = ref?.nome ?? null;
      }
      diffs.push({
        campo: CAMPOS_EDITAVEIS[key],
        valorAntigo: nomeAtualPorCampo[key] ?? null,
        valorNovo: valorNovoLegivel,
      });
      continue;
    }

    diffs.push({
      campo: CAMPOS_EDITAVEIS[key],
      valorAntigo: toText(antigo),
      valorNovo: toText(novo),
    });
  }

  if (diffs.length === 0) return item; // nada mudou, nada a registrar

  // Atômico em UM round-trip HTTP: db.batch roda tudo em uma transação, sem
  // depender do Pool/WebSocket (mais robusto em serverless). O UPDATE e as N
  // linhas de histórico entram juntos, ou nada entra.
  const [atualizados] = await db.batch([
    db.update(itensProjeto).set(updateValues).where(eq(itensProjeto.id, id)).returning(),
    db.insert(historicoAlteracoes).values(
      diffs.map((d) => ({
        itemId: id,
        empreendimentoId: item.empreendimentoId,
        acao: "edicao" as const,
        usuarioId: user.id,
        campo: d.campo,
        valorAntigo: d.valorAntigo,
        valorNovo: d.valorNovo,
        empreendimentoNome: atual.empNome,
        itemNumero: item.item,
        disciplinaNome: atual.discNome,
      })),
    ),
  ]);

  const row = atualizados[0];
  revalidatePath(`/empreendimentos/${row.empreendimentoId}`);
  return row;
}

export async function deleteItem(id: string): Promise<{ id: string }> {
  const { user } = await requireEscrita();

  // Captura contexto para descrever a exclusão (o item deixará de existir).
  const [alvo] = await db
    .select({
      empreendimentoId: itensProjeto.empreendimentoId,
      empreendimentoNome: empreendimentos.nome,
      item: itensProjeto.item,
      planta: itensProjeto.planta,
      disciplinaNome: disciplinas.nome,
    })
    .from(itensProjeto)
    .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
    .innerJoin(empreendimentos, eq(empreendimentos.id, itensProjeto.empreendimentoId))
    .where(eq(itensProjeto.id, id))
    .limit(1);

  if (!alvo) throw new Error("Item não encontrado.");

  const numero = alvo.item != null ? String(alvo.item).padStart(2, "0") : "s/nº";
  const descricao = `Item ${numero} — ${alvo.disciplinaNome}${alvo.planta ? ` — ${alvo.planta}` : ""}`;

  // Exclui o item e registra a exclusão no empreendimento pai. Com a FK em
  // SET NULL, o item_id do log fica nulo, mas o registro (e o contexto
  // denormalizado) sobrevive. Atômico via batch.
  await db.batch([
    db.delete(itensProjeto).where(eq(itensProjeto.id, id)),
    db.insert(historicoAlteracoes).values({
      itemId: null,
      empreendimentoId: alvo.empreendimentoId,
      acao: "exclusao",
      usuarioId: user.id,
      campo: "item",
      valorAntigo: descricao,
      empreendimentoNome: alvo.empreendimentoNome,
      itemNumero: alvo.item,
      disciplinaNome: alvo.disciplinaNome,
    }),
  ]);

  revalidatePath(`/empreendimentos/${alvo.empreendimentoId}`);
  return { id };
}
