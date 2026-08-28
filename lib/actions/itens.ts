"use server";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { neonAuthUser } from "@/db/neonAuth";
import {
  disciplinas,
  empreendimentos,
  etapas,
  historicoAlteracoes,
  itensProjeto,
  projetistas,
  revisoesItem,
} from "@/db/schema";
import type { ItemProjeto, PrioridadeItem, StatusItem } from "@/db/schema";
import { requireEscrita, requireUser } from "@/lib/auth/session";
import { hojeISORecife, resolverStatus, rotuloRevisao, rotuloUsuario } from "@/lib/ui/status";

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
  prioridade?: PrioridadeItem;
  usuarioAnaliseId?: string | null; // obrigatório quando status = 'em_analise'
  dataInicio?: string | null; // 'YYYY-MM-DD'
  prazoPrevisto?: string | null;
  prazoReprogramado?: string | null;
  prazoRealizado?: string | null;
  observacoes?: string | null;
  // Revisão: não vem mais de campo digitável na interface. Fica na entrada
  // para o fluxo de revisão (botão "Nova revisão") poder gravá-la.
  revisaoAtual?: string | null; // "R00"
  dataRevisao?: string | null;
  enviadoAutodoc?: boolean;
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
  prioridade: "prioridade",
  usuarioAnaliseId: "usuario_analise",
  dataInicio: "data_inicio",
  prazoPrevisto: "prazo_previsto",
  prazoReprogramado: "prazo_reprogramado",
  prazoRealizado: "prazo_realizado",
  observacoes: "observacoes",
  revisaoAtual: "revisao_atual",
  dataRevisao: "data_revisao",
  enviadoAutodoc: "enviado_autodoc",
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
  usuarioAnaliseNome: string | null;
};

export type ItemDashboard = ItemComRefs & {
  empreendimentoNome: string;
};

// Ordem de trabalho das listagens:
//  1) status — pendente no topo (é o que precisa ser programado), em
//     andamento e em análise no meio, finalizado e cancelado por último;
//  2) dentro do grupo, a data-alvo mais próxima primeiro (reprogramado tem
//     precedência sobre previsto); itens sem nenhuma data ficam ao final.
// O CASE espelha ORDEM_STATUS em lib/ui/status.ts.
// O dashboard antepõe a prioridade a esses dois critérios (ORDEM_PRIORIDADE_SQL);
// a lista de um empreendimento segue só por status e data-alvo.
const ORDEM_STATUS_SQL = sql`case ${itensProjeto.status}
  when 'pendente' then 0
  when 'em_andamento' then 1
  when 'em_analise' then 2
  when 'finalizado' then 3
  when 'cancelado' then 4
  else 5 end asc`;

const ORDEM_DATA_ALVO = sql`coalesce(${itensProjeto.prazoReprogramado}, ${itensProjeto.prazoPrevisto}) asc nulls last`;

// Critério principal do dashboard: a prioridade do item, da maior para a
// menor. Status e data-alvo continuam valendo, mas como desempate dentro de
// cada faixa de prioridade. Espelha PRIORIDADES em lib/ui/status.ts, invertida.
const ORDEM_PRIORIDADE_SQL = sql`case ${itensProjeto.prioridade}
  when 'alta' then 0
  when 'media' then 1
  when 'baixa' then 2
  else 3 end asc`;

// Nome exibível de quem analisa: o join com neon_auth.user é por cast, pois
// usuario_analise_id é text e neon_auth.user.id é uuid (mesma razão do join
// de usuarios_papel em lib/actions/usuarios.ts).
const JOIN_USUARIO_ANALISE = sql`${neonAuthUser.id}::text = ${itensProjeto.usuarioAnaliseId}`;

function nomeAnalise(
  usuarioAnaliseId: string | null,
  name: string | null,
  email: string | null,
): string | null {
  if (!usuarioAnaliseId) return null;
  return rotuloUsuario(name, email);
}

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
      analiseName: neonAuthUser.name,
      analiseEmail: neonAuthUser.email,
    })
    .from(itensProjeto)
    .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
    .innerJoin(etapas, eq(etapas.id, itensProjeto.etapaId))
    .leftJoin(projetistas, eq(projetistas.id, itensProjeto.projetistaId))
    .leftJoin(neonAuthUser, JOIN_USUARIO_ANALISE)
    .where(and(...conds))
    .orderBy(ORDEM_STATUS_SQL, ORDEM_DATA_ALVO);

  return rows.map((r) => ({
    ...r.item,
    disciplinaNome: r.disciplinaNome,
    etapaNome: r.etapaNome,
    projetistaNome: r.projetistaNome,
    usuarioAnaliseNome: nomeAnalise(r.item.usuarioAnaliseId, r.analiseName, r.analiseEmail),
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
      analiseName: neonAuthUser.name,
      analiseEmail: neonAuthUser.email,
    })
    .from(itensProjeto)
    .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
    .innerJoin(etapas, eq(etapas.id, itensProjeto.etapaId))
    .leftJoin(projetistas, eq(projetistas.id, itensProjeto.projetistaId))
    .leftJoin(neonAuthUser, JOIN_USUARIO_ANALISE)
    .innerJoin(empreendimentos, eq(empreendimentos.id, itensProjeto.empreendimentoId))
    .orderBy(ORDEM_PRIORIDADE_SQL, ORDEM_STATUS_SQL, ORDEM_DATA_ALVO);

  return rows.map((r) => ({
    ...r.item,
    disciplinaNome: r.disciplinaNome,
    etapaNome: r.etapaNome,
    projetistaNome: r.projetistaNome,
    usuarioAnaliseNome: nomeAnalise(r.item.usuarioAnaliseId, r.analiseName, r.analiseEmail),
    empreendimentoNome: r.empreendimentoNome,
  }));
}

/* ------------------------------------------------------------------ *
 * Escrita
 * ------------------------------------------------------------------ */

/**
 * Dados para fechar a revisão em aberto de um item — ou null se não houver.
 * Não escreve nada: quem chama inclui os UPDATEs no próprio batch, para o
 * item, a revisão e o histórico entrarem juntos.
 *
 * O número da revisão (R00 → R01 → ...) é a CONTAGEM DE ENTREGAS ao Autodoc,
 * então é aqui — e só aqui — que ele avança. Uma revisão apenas SOLICITADA
 * não mexe no número.
 *
 * Privada de propósito: o arquivo é "use server", e todo export vira um
 * endpoint chamável pelo cliente. A autorização já foi feita em updateItem.
 */
async function calcularFechamentoRevisao(itemId: string): Promise<{
  hoje: string;
  numero: number;
  revisaoAtual: string;
} | null> {
  const [aberta] = await db
    .select({ numero: revisoesItem.numero })
    .from(revisoesItem)
    .where(and(eq(revisoesItem.itemId, itemId), isNull(revisoesItem.realizadaEm)))
    .orderBy(asc(revisoesItem.numero))
    .limit(1);

  if (!aberta) return null;

  // Entregues até agora + esta. Contar, em vez de usar o ordinal, protege o
  // número de um eventual furo na sequência.
  const [{ entregues }] = await db
    .select({ entregues: sql<number>`count(*)::int` })
    .from(revisoesItem)
    .where(and(eq(revisoesItem.itemId, itemId), sql`${revisoesItem.realizadaEm} is not null`));

  return {
    hoje: hojeISORecife(),
    numero: aberta.numero,
    revisaoAtual: rotuloRevisao(entregues + 1),
  };
}

/**
 * Regra do status 'em_analise': só existe com um usuário responsável pela
 * análise. Validado no servidor (o cliente também avisa antes de salvar).
 */
function validarAnalise(status: StatusItem, usuarioAnaliseId: string | null): void {
  if (status === "em_analise" && !usuarioAnaliseId) {
    throw new Error("Informe o usuário da análise para deixar o item Em análise.");
  }
}

export async function createItem(input: ItemInput): Promise<ItemProjeto> {
  const { user } = await requireEscrita();

  if (!input.empreendimentoId) throw new Error("empreendimentoId é obrigatório.");
  if (!input.disciplinaId) throw new Error("disciplinaId é obrigatório.");
  if (!input.etapaId) throw new Error("etapaId é obrigatório.");

  // 'pendente' = sem prazo previsto; com previsto, o item já nasce em
  // andamento. O cliente também aplica a regra, mas quem manda é aqui.
  const prazoPrevisto = input.prazoPrevisto ?? null;
  const status = resolverStatus(input.status ?? "pendente", prazoPrevisto);
  // Fora de 'em_analise' o responsável não se aplica — não guardamos resíduo.
  const usuarioAnaliseId = status === "em_analise" ? input.usuarioAnaliseId ?? null : null;
  validarAnalise(status, usuarioAnaliseId);

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
        status,
        prioridade: input.prioridade ?? "media",
        usuarioAnaliseId,
        dataInicio: input.dataInicio ?? null,
        prazoPrevisto,
        prazoReprogramado: input.prazoReprogramado ?? null,
        prazoRealizado: input.prazoRealizado ?? null,
        observacoes: input.observacoes ?? null,
        revisaoAtual: input.revisaoAtual?.trim() || "R00",
        dataRevisao: input.dataRevisao ?? null,
        enviadoAutodoc: input.enviadoAutodoc ?? false,
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
      analiseName: neonAuthUser.name,
      analiseEmail: neonAuthUser.email,
    })
    .from(itensProjeto)
    .innerJoin(empreendimentos, eq(empreendimentos.id, itensProjeto.empreendimentoId))
    .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
    .innerJoin(etapas, eq(etapas.id, itensProjeto.etapaId))
    .leftJoin(projetistas, eq(projetistas.id, itensProjeto.projetistaId))
    .leftJoin(neonAuthUser, JOIN_USUARIO_ANALISE)
    .where(eq(itensProjeto.id, id))
    .limit(1);

  if (!atual) throw new Error("Item não encontrado.");
  const item = atual.item;

  // Estado FINAL de status/prazo previsto/usuário da análise (o patch pode
  // trazer só parte disso). O status passa por resolverStatus: pendente e em
  // andamento acompanham a presença do prazo previsto, nos dois sentidos.
  const prazoPrevistoFinal =
    "prazoPrevisto" in patch ? patch.prazoPrevisto ?? null : item.prazoPrevisto;
  const statusFinal = resolverStatus(patch.status ?? item.status, prazoPrevistoFinal);
  // Fora de 'em_analise' o responsável é limpo, para não sobrar resíduo de
  // uma análise anterior.
  const usuarioAnaliseFinal =
    statusFinal === "em_analise"
      ? "usuarioAnaliseId" in patch
        ? patch.usuarioAnaliseId ?? null
        : item.usuarioAnaliseId
      : null;
  validarAnalise(statusFinal, usuarioAnaliseFinal);
  // status entra no patch mesmo quando não veio do cliente: a transição
  // automática pendente → em andamento precisa aparecer no histórico.
  const patchFinal: Partial<Omit<ItemInput, "empreendimentoId">> = {
    ...patch,
    status: statusFinal,
    usuarioAnaliseId: usuarioAnaliseFinal,
  };

  // Marcar o Autodoc num item EM REVISÃO é o que ENTREGA aquela revisão: é
  // o gatilho que faz R00 virar R01. Resolvido aqui, antes do diff, para
  // revisao_atual/data_revisao entrarem no histórico como qualquer campo.
  const entregandoRevisao =
    item.emRevisao && patchFinal.enviadoAutodoc === true && !item.enviadoAutodoc;
  const fechamento = entregandoRevisao ? await calcularFechamentoRevisao(id) : null;
  if (fechamento) {
    patchFinal.revisaoAtual = fechamento.revisaoAtual;
    patchFinal.dataRevisao = fechamento.hoje;
  }

  // Nomes atuais das entidades referenciadas (para o "antigo" do diff).
  const nomeAtualPorCampo: Partial<Record<CampoEditavel, string | null>> = {
    disciplinaId: atual.discNome,
    etapaId: atual.etapaNome,
    projetistaId: atual.projetistaNome,
    usuarioAnaliseId: nomeAnalise(item.usuarioAnaliseId, atual.analiseName, atual.analiseEmail),
  };

  const updateValues: Record<string, unknown> = {};
  const diffs: {
    campo: string;
    valorAntigo: string | null;
    valorNovo: string | null;
  }[] = [];

  for (const key of Object.keys(patchFinal) as CampoEditavel[]) {
    if (!(key in CAMPOS_EDITAVEIS)) continue; // ignora chaves não editáveis
    const novo = patchFinal[key] as unknown;
    const antigo = (item as Record<string, unknown>)[key];

    if (toText(antigo) === toText(novo)) continue; // sem mudança

    updateValues[key] = novo ?? null;

    // O usuário da análise vive no schema do Neon Auth — o histórico grava
    // o nome legível, não o uuid.
    if (key === "usuarioAnaliseId") {
      let nomeNovo: string | null = null;
      if (novo) {
        const [u] = await db
          .select({ name: neonAuthUser.name, email: neonAuthUser.email })
          .from(neonAuthUser)
          .where(sql`${neonAuthUser.id}::text = ${novo as string}`)
          .limit(1);
        nomeNovo = u ? rotuloUsuario(u.name, u.email) : null;
      }
      diffs.push({
        campo: CAMPOS_EDITAVEIS[key],
        valorAntigo: nomeAtualPorCampo.usuarioAnaliseId ?? null,
        valorNovo: nomeNovo,
      });
      continue;
    }

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

    if (key === "enviadoAutodoc") {
      diffs.push({
        campo: CAMPOS_EDITAVEIS[key],
        valorAntigo: antigo ? "Sim" : "Não",
        valorNovo: novo ? "Sim" : "Não",
      });
      continue;
    }

    diffs.push({
      campo: CAMPOS_EDITAVEIS[key],
      valorAntigo: toText(antigo),
      valorNovo: toText(novo),
    });
  }

  // A ida para 'em_analise' é o marco de ENTREGA DO PROJETISTA: a análise
  // que vem depois é interna da equipe de arquitetos, então a parte dele já
  // terminou mesmo com o item ainda aberto (o item só fecha no Autodoc).
  // Registrado como linha própria para o histórico dizer isso explicitamente.
  if (item.status !== "em_analise" && statusFinal === "em_analise") {
    const diffProjetista = diffs.find((d) => d.campo === CAMPOS_EDITAVEIS.projetistaId);
    const nomeProjetista = diffProjetista ? diffProjetista.valorNovo : atual.projetistaNome;
    diffs.push({
      campo: "entrega_projetista",
      valorAntigo: null,
      valorNovo: `${nomeProjetista ?? "Projetista"} finalizou a parte dele`,
    });
  }

  // Marco explícito da entrega: o par revisao_atual/data_revisao acima diz
  // o QUE mudou, esta linha diz por quê.
  if (fechamento) {
    diffs.push({
      campo: "revisao_realizada",
      valorAntigo: null,
      valorNovo: `${rotuloRevisao(fechamento.numero)} enviada para o Autodoc`,
    });
    // Sai do estado de revisão: o ciclo com o projetista terminou.
    updateValues.emRevisao = false;
  }

  if (diffs.length === 0) return item; // nada mudou, nada a registrar

  // Atômico em UM round-trip HTTP: db.batch roda tudo em uma transação, sem
  // depender do Pool/WebSocket (mais robusto em serverless). O UPDATE e as N
  // linhas de histórico entram juntos, ou nada entra.
  const [atualizados] = await db.batch([
    db.update(itensProjeto).set(updateValues).where(eq(itensProjeto.id, id)).returning(),
    // Carimba a entrega na revisão aberta. Fica sempre no batch (para não
    // quebrar a tupla de resultados); o `false` o torna um no-op quando não
    // há revisão sendo entregue.
    db
      .update(revisoesItem)
      .set({ realizadaEm: fechamento?.hoje ?? null })
      .where(
        and(
          eq(revisoesItem.itemId, id),
          isNull(revisoesItem.realizadaEm),
          fechamento ? sql`true` : sql`false`,
        ),
      ),
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
