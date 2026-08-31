"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
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
import type { Projetista, StatusItem } from "@/db/schema";
import { requireEscrita, requireUser } from "@/lib/auth/session";
import { hojeISORecife } from "@/lib/ui/status";

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
  emRevisao: boolean;
  /**
   * Data em que o item foi para 'em_analise' — o marco de ENTREGA DO
   * PROJETISTA (ele já mandou o projeto para a nossa equipe). É o que fecha o
   * item na ótica do projetista, mesmo com o item ainda aberto. Null enquanto
   * ele não entregou; cai no prazo realizado para os itens anteriores ao
   * registro desse marco no histórico.
   */
  entregaProjetista: string | null;
};

/**
 * Uma OCORRÊNCIA de atraso — não é uma linha por item, é uma linha por prazo
 * estourado. Um item cujo previsto furou e cuja reprogramação furou de novo
 * gera DUAS ocorrências: é essa reincidência que pesa contra o projetista.
 */
export type AtrasoProjetista = {
  id: string; // itemId + ordinal (chave de render)
  itemId: string;
  ordem: number; // 1 = primeiro atraso do item, 2 = reincidência, ...
  empreendimentoNome: string;
  disciplinaNome: string;
  etapaNome: string;
  item: number | null;
  dataInicio: string | null;
  /** O prazo estourado (o previsto original ou uma das reprogramações). */
  prazoAtraso: string | null;
  /** De onde veio esse prazo. */
  origem: "previsto" | "reprogramado";
  /**
   * Prazo REALIZADO do item — o mesmo campo que a listagem de itens mostra.
   * É do item, não da ocorrência: as duas últimas colunas da tabela (realizado
   * e desvio) falam do estado do item hoje, e não do momento do atraso.
   */
  prazoRealizado: string | null;
  /** Entrega do projetista (ida para análise). Null se ele não entregou. */
  realizado: string | null;
  /** Para onde o prazo foi empurrado, quando o atraso virou reprogramação. */
  reprogramadoPara: string | null;
  /** Dias de atraso da ocorrência (contra a entrega, a reprogramação ou hoje). */
  dias: number;
  /** Ainda correndo: sem entrega e sem reprogramação — cresce todo dia. */
  emAberto: boolean;
};

export type PainelProjetista = {
  itens: DesempenhoProjetista[];
  atrasos: AtrasoProjetista[];
};

/** Diferença em dias entre duas datas 'YYYY-MM-DD' (a − b). */
function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

type EventoPrazo = {
  campo: string | null;
  valorAntigo: string | null;
  valorNovo: string | null;
  data: string;
};

/**
 * Reconstrói, a partir da auditoria, a linha do tempo dos prazos de um item e
 * devolve uma ocorrência para cada prazo que estourou.
 *
 * A leitura segue a semântica que o resto do app já usa (ver derivarStatus):
 * REPROGRAMAR é o reconhecimento de que o prazo vigente furou — por isso um
 * item reprogramado aparece em vermelho mesmo com a data nova no futuro. Aqui
 * é a mesma regra: todo prazo empurrado para frente conta como um atraso, e o
 * prazo vigente no fim conta de novo se a entrega veio depois dele (ou se
 * ainda não veio e ele já passou). Antecipar ou limpar a data não conta: é
 * correção de cadastro, não atraso.
 */
function derivarAtrasos(
  it: DesempenhoProjetista,
  eventos: EventoPrazo[],
  hoje: string,
): AtrasoProjetista[] {
  const base = {
    itemId: it.id,
    empreendimentoNome: it.empreendimentoNome,
    disciplinaNome: it.disciplinaNome,
    etapaNome: it.etapaNome,
    item: it.item,
    dataInicio: it.dataInicio,
    prazoRealizado: it.prazoRealizado,
  };
  const out: AtrasoProjetista[] = [];
  const registrar = (o: Omit<AtrasoProjetista, keyof typeof base | "id" | "ordem">) => {
    out.push({ ...base, ...o, id: `${it.id}:${out.length + 1}`, ordem: out.length + 1 });
  };

  // Estado ANTES do primeiro evento: parte do valor atual e desfaz o histórico
  // de trás para frente (o valorAntigo de cada evento é o estado anterior).
  let previsto = it.prazoPrevisto;
  let reprogramado = it.prazoReprogramado;
  for (let i = eventos.length - 1; i >= 0; i--) {
    const ev = eventos[i];
    if (ev.campo === "prazo_previsto") previsto = ev.valorAntigo;
    else if (ev.campo === "prazo_reprogramado") reprogramado = ev.valorAntigo;
  }

  // Agora para frente: cada empurrão do prazo vigente vira uma ocorrência.
  for (const ev of eventos) {
    if (ev.campo !== "prazo_previsto" && ev.campo !== "prazo_reprogramado") continue;
    const antes = reprogramado ?? previsto;
    const origem: "previsto" | "reprogramado" = reprogramado ? "reprogramado" : "previsto";
    if (ev.campo === "prazo_previsto") previsto = ev.valorNovo;
    else reprogramado = ev.valorNovo;
    const depois = reprogramado ?? previsto;
    if (antes && depois && depois > antes) {
      registrar({
        prazoAtraso: antes,
        origem,
        realizado: null,
        reprogramadoPara: depois,
        dias: diasEntre(depois, antes),
        emAberto: false,
      });
    }
  }

  // O prazo que está valendo hoje: estoura contra a entrega do projetista (ou
  // contra hoje, se ele ainda não entregou).
  const vigente = it.prazoReprogramado ?? it.prazoPrevisto;
  const entrega = it.entregaProjetista;
  // Sem data de entrega, mas já entregue: itens que foram para análise antes
  // do marco 'entrega_projetista' passar a ser gravado. Não dá para medir o
  // desvio deles, e contar como atraso EM ABERTO seria falso — o projetista
  // já mandou o projeto. Ficam de fora da última ocorrência; as anteriores,
  // vindas de reprogramação, continuam valendo.
  const entregueSemData =
    !entrega && (it.status === "em_analise" || it.status === "finalizado");
  const origemVigente: "previsto" | "reprogramado" = it.prazoReprogramado
    ? "reprogramado"
    : "previsto";
  if (vigente) {
    if (entrega && entrega > vigente) {
      registrar({
        prazoAtraso: vigente,
        origem: origemVigente,
        realizado: entrega,
        reprogramadoPara: null,
        dias: diasEntre(entrega, vigente),
        emAberto: false,
      });
    } else if (!entrega && !entregueSemData && hoje > vigente) {
      registrar({
        prazoAtraso: vigente,
        origem: origemVigente,
        realizado: null,
        reprogramadoPara: null,
        dias: diasEntre(hoje, vigente),
        emAberto: true,
      });
    }
  }

  return out;
}

/**
 * Itens já atribuídos ao projetista + o histórico de atrasos derivado deles.
 *
 * Nada disso é gravado: o desvio sai de `derivarStatusProjetista` na UI e os
 * atrasos saem da auditoria (historico_alteracoes), mantendo uma única fonte
 * de verdade para a regra.
 */
export async function listPainelProjetista(projetistaId: string): Promise<PainelProjetista> {
  await requireUser();

  const itens = await db
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
      emRevisao: itensProjeto.emRevisao,
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

  if (itens.length === 0) return { itens: [], atrasos: [] };

  // Linha do tempo dos prazos + o marco de entrega do projetista. A data do
  // evento sai como 'YYYY-MM-DD' no fuso de Recife (created_at é timestamptz).
  const ids = itens.map((i) => i.id);
  const eventos = await db
    .select({
      itemId: historicoAlteracoes.itemId,
      campo: historicoAlteracoes.campo,
      valorAntigo: historicoAlteracoes.valorAntigo,
      valorNovo: historicoAlteracoes.valorNovo,
      data: sql<string>`to_char(${historicoAlteracoes.createdAt} at time zone 'America/Recife', 'YYYY-MM-DD')`,
    })
    .from(historicoAlteracoes)
    .where(
      and(
        inArray(historicoAlteracoes.itemId, ids),
        inArray(historicoAlteracoes.campo, [
          "prazo_previsto",
          "prazo_reprogramado",
          "entrega_projetista",
        ]),
      ),
    )
    .orderBy(asc(historicoAlteracoes.createdAt));

  const porItem = new Map<string, EventoPrazo[]>();
  for (const ev of eventos) {
    if (!ev.itemId) continue;
    const lista = porItem.get(ev.itemId);
    if (lista) lista.push(ev);
    else porItem.set(ev.itemId, [ev]);
  }

  const hoje = hojeISORecife();
  const comEntrega: DesempenhoProjetista[] = itens.map((it) => {
    const evs = porItem.get(it.id) ?? [];
    const marco = evs.find((e) => e.campo === "entrega_projetista");
    // Itens que já estavam em análise/finalizados antes desse marco existir não
    // têm a linha no histórico — o prazo realizado cobre o buraco.
    return { ...it, entregaProjetista: marco?.data ?? it.prazoRealizado };
  });

  const atrasos = comEntrega
    .flatMap((it) => derivarAtrasos(it, porItem.get(it.id) ?? [], hoje))
    // Mais recentes primeiro; as reincidências do mesmo item ficam juntas.
    .sort(
      (a, b) => (b.prazoAtraso ?? "").localeCompare(a.prazoAtraso ?? "") || a.ordem - b.ordem,
    );

  return { itens: comEntrega, atrasos };
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
