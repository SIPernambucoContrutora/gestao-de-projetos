"use server";

import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  disciplinas,
  empreendimentos,
  etapas,
  historicoAlteracoes,
  itensProjeto,
  projetistas,
  revisoesItem,
} from "@/db/schema";
import type { RevisaoItem } from "@/db/schema";
import { requireEscrita, requireUser } from "@/lib/auth/session";
import { enviarSemBloquear } from "@/lib/email/enviar";
import { mensagemRevisao } from "@/lib/email/templates";
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
      etapaNome: etapas.nome,
      projetistaNome: projetistas.nome,
      projetistaEmail: projetistas.email,
    })
    .from(itensProjeto)
    .innerJoin(empreendimentos, eq(empreendimentos.id, itensProjeto.empreendimentoId))
    .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
    .innerJoin(etapas, eq(etapas.id, itensProjeto.etapaId))
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

  // Avisa o projetista, com o texto da solicitação no corpo.
  //
  // DEPOIS do batch, e sem await no caminho de erro: a revisão já está
  // commitada e não pode ser desfeita porque o SMTP caiu. enviarSemBloquear
  // engole a falha e a registra em emails_enviados — ver lib/email/enviar.ts.
  //
  // O e-mail vai para o endereço CONGELADO na revisão, não para o cadastro
  // atual do projetista: a solicitação foi feita a quem era o responsável
  // agora, e é esse o destinatário certo mesmo que o cadastro mude depois.
  await enviarSemBloquear({
    tipo: "revisao_aberta",
    itemId,
    // O id da revisão é único por natureza: uma solicitação, um e-mail.
    referencia: novoId,
    destinatario: atual.projetistaEmail,
    mensagem: mensagemRevisao(
      {
        projetistaNome: atual.projetistaNome ?? "projetista",
        empreendimento: atual.empNome,
        disciplina: atual.discNome,
        etapa: atual.etapaNome,
        itemNumero: item.item,
        planta: item.planta,
      },
      rotuloRevisao(numero),
      texto,
    ),
    contexto: {
      projetistaNome: atual.projetistaNome,
      empreendimentoNome: atual.empNome,
      itemNumero: item.item,
    },
  });

  // O dashboard consolidado ("/") lista os itens de TODOS os empreendimentos:
  // sem revalidá-lo, ele segue servindo a versão em cache depois da edição.
  revalidatePath(`/empreendimentos/${item.empreendimentoId}`);
  revalidatePath("/");
  return inseridas[0];
}
