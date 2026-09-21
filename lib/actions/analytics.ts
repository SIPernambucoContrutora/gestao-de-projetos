"use server";

import { eq, sql } from "drizzle-orm";
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
import type { CategoriaDisciplina, FaseEmpreendimento, TipoEmpreendimento } from "@/db/schema";
import type { ItemComRefs } from "@/lib/actions/itens";
import { requireUser } from "@/lib/auth/session";
import { hojeISORecife, rotuloUsuario } from "@/lib/ui/status";

/* ------------------------------------------------------------------ *
 * Tela de Indicadores — leitura agregada.
 *
 * Uma linha por item — e não só os campos que os gráficos leem: é
 * ItemComRefs (o MESMO tipo que o drawer de edição em ItensBoard.tsx usa)
 * mais o que só a AUDITORIA sabe responder (quando o item nasceu, quantas
 * vezes o prazo foi empurrado, quando o projetista entregou). É esse
 * superset que permite abrir o item direto da tela de Indicadores para
 * editá-lo — sem outra consulta, sem outro tipo de linha.
 *
 * O recorte, a contagem e o desvio ficam no cliente, em
 * lib/ui/indicadores.ts — é o que permite cross-filter instantâneo sem um
 * round-trip por clique, e mantém UMA implementação das regras de status
 * (a de lib/ui/status.ts) valendo para tudo.
 *
 * Três consultas em vez de um LATERAL por item: a agregação do histórico e
 * a das revisões varrem suas tabelas uma vez só e são casadas em memória.
 * ------------------------------------------------------------------ */

export type LinhaIndicador = ItemComRefs & {
  empreendimentoNome: string;
  empreendimentoTipo: TipoEmpreendimento | null;
  empreendimentoFase: FaseEmpreendimento | null;
  disciplinaCategoria: CategoriaDisciplina | null;

  /** Nascimento do item (auditoria: acao='criacao'). itens_projeto não tem created_at. */
  criadoEm: string | null;
  /**
   * Marco da ida para 'em_analise' — a entrega DO PROJETISTA. Cai no prazo
   * realizado nos itens anteriores ao marco existir (mesma retaguarda de
   * lib/actions/projetistas.ts), senão a série teria um degrau falso.
   */
  entregaProjetista: string | null;
  /** Quantas vezes um prazo foi empurrado para frente. */
  reprogramacoes: number;
  /** Soma dos dias que essas reprogramações empurraram. */
  diasEmpurrados: number;
  /** O item já voltou da análise pedindo ajustes pelo menos uma vez. */
  teveAjustes: boolean;
  /** Revisões já ENTREGUES ao Autodoc. */
  revisoes: number;
  /** Revisão em aberto (0 ou 1 — há índice único garantindo isso). */
  revisoesAbertas: number;
};

export type DadosIndicadores = {
  itens: LinhaIndicador[];
  /** Hoje no fuso de Recife — a mesma referência que o resto do app usa. */
  hojeISO: string;
};

/** Converte timestamptz para 'YYYY-MM-DD' no fuso de Recife. */
const DATA_RECIFE = (col: typeof historicoAlteracoes.createdAt) =>
  sql<string>`to_char(${col} at time zone 'America/Recife', 'YYYY-MM-DD')`;

/**
 * Guarda de formato para os valores de prazo na auditoria — valor_antigo e
 * valor_novo são TEXT livres, e o cast para date só pode acontecer atrás
 * dela.
 *
 * Classe de caractere, e NÃO '\d': a barra invertida não sobrevive à
 * viagem pelo template da query, e o padrão chega ao Postgres como 'd{4}',
 * que não casa com nada. O sintoma é silencioso — zero reprogramações em
 * qualquer base, como se nenhum prazo tivesse sido empurrado na vida.
 */
const ISO_DATA = sql`'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`;

/** Uma edição de prazo que empurrou a data para FRENTE. */
const EMPURROU = sql`${historicoAlteracoes.campo} in ('prazo_previsto', 'prazo_reprogramado')
  and ${historicoAlteracoes.valorAntigo} ~ ${ISO_DATA}
  and ${historicoAlteracoes.valorNovo} ~ ${ISO_DATA}
  and ${historicoAlteracoes.valorNovo}::date > ${historicoAlteracoes.valorAntigo}::date`;

/**
 * Dias que essas reprogramações empurraram. Antecipar ou limpar a data não
 * conta: é correção de cadastro, não atraso — a mesma leitura de
 * derivarAtrasos em lib/actions/projetistas.ts.
 *
 * O CASE (e não um FILTER) é intencional: garante que o cast para date só
 * seja avaliado nas linhas que passaram pela guarda de formato.
 */
const DIAS_EMPURRADOS = sql<number>`coalesce(sum(
  case
    when ${EMPURROU}
    then ${historicoAlteracoes.valorNovo}::date - ${historicoAlteracoes.valorAntigo}::date
    else 0
  end
), 0)::int`;

const REPROGRAMACOES = sql<number>`count(*) filter (where ${EMPURROU})::int`;

// Mesmo join por cast de listTodosItens em lib/actions/itens.ts:
// usuario_analise_id é text, neon_auth.user.id é uuid.
const JOIN_USUARIO_ANALISE = sql`${neonAuthUser.id}::text = ${itensProjeto.usuarioAnaliseId}`;

/**
 * Todos os itens com os derivados da auditoria. Leitura — qualquer usuário
 * autenticado.
 */
export async function getDadosIndicadores(): Promise<DadosIndicadores> {
  await requireUser();

  const [linhas, marcos, revs] = await Promise.all([
    db
      .select({
        item: itensProjeto,
        disciplinaNome: disciplinas.nome,
        disciplinaCategoria: disciplinas.categoria,
        etapaNome: etapas.nome,
        projetistaNome: projetistas.nome,
        empreendimentoNome: empreendimentos.nome,
        empreendimentoTipo: empreendimentos.tipo,
        empreendimentoFase: empreendimentos.fase,
        analiseName: neonAuthUser.name,
        analiseEmail: neonAuthUser.email,
      })
      .from(itensProjeto)
      .innerJoin(empreendimentos, eq(empreendimentos.id, itensProjeto.empreendimentoId))
      .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
      .innerJoin(etapas, eq(etapas.id, itensProjeto.etapaId))
      .leftJoin(projetistas, eq(projetistas.id, itensProjeto.projetistaId))
      .leftJoin(neonAuthUser, JOIN_USUARIO_ANALISE),

    db
      .select({
        itemId: historicoAlteracoes.itemId,
        criadoEm: sql<string | null>`min(${DATA_RECIFE(historicoAlteracoes.createdAt)}) filter (
          where ${historicoAlteracoes.acao} = 'criacao'
        )`,
        entrega: sql<string | null>`max(${DATA_RECIFE(historicoAlteracoes.createdAt)}) filter (
          where ${historicoAlteracoes.campo} = 'entrega_projetista'
        )`,
        ajustes: sql<number>`count(*) filter (
          where ${historicoAlteracoes.campo} = 'ajustes_pos_analise'
        )::int`,
        reprogramacoes: REPROGRAMACOES,
        diasEmpurrados: DIAS_EMPURRADOS,
      })
      .from(historicoAlteracoes)
      .where(sql`${historicoAlteracoes.itemId} is not null`)
      .groupBy(historicoAlteracoes.itemId),

    db
      .select({
        itemId: revisoesItem.itemId,
        entregues: sql<number>`count(*) filter (where ${revisoesItem.realizadaEm} is not null)::int`,
        abertas: sql<number>`count(*) filter (where ${revisoesItem.realizadaEm} is null)::int`,
      })
      .from(revisoesItem)
      .groupBy(revisoesItem.itemId),
  ]);

  const porItem = new Map(marcos.map((m) => [m.itemId as string, m]));
  const revPorItem = new Map(revs.map((r) => [r.itemId, r]));

  const itens: LinhaIndicador[] = linhas.map((l) => {
    const m = porItem.get(l.item.id);
    const r = revPorItem.get(l.item.id);
    return {
      ...l.item,
      disciplinaNome: l.disciplinaNome,
      disciplinaCategoria: l.disciplinaCategoria,
      etapaNome: l.etapaNome,
      projetistaNome: l.projetistaNome,
      usuarioAnaliseNome: l.item.usuarioAnaliseId
        ? rotuloUsuario(l.analiseName, l.analiseEmail)
        : null,
      empreendimentoNome: l.empreendimentoNome,
      empreendimentoTipo: l.empreendimentoTipo,
      empreendimentoFase: l.empreendimentoFase,
      criadoEm: m?.criadoEm ?? null,
      // Sem o marco (itens anteriores a ele), o prazo realizado responde pela data.
      entregaProjetista: m?.entrega ?? l.item.prazoRealizado,
      reprogramacoes: m?.reprogramacoes ?? 0,
      diasEmpurrados: m?.diasEmpurrados ?? 0,
      teveAjustes: (m?.ajustes ?? 0) > 0,
      revisoes: r?.entregues ?? 0,
      revisoesAbertas: r?.abertas ?? 0,
    };
  });

  return { itens, hojeISO: hojeISORecife() };
}
