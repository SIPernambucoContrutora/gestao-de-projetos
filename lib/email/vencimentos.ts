import "@/lib/server-only-guard";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { disciplinas, empreendimentos, etapas, itensProjeto, projetistas } from "@/db/schema";
import { formatBR, hojeISORecife } from "@/lib/ui/status";
import { enviarEmail } from "./enviar";
import { mensagemVencimento } from "./templates";

export type ResumoVarredura = {
  data: string;
  encontrados: number;
  enviados: number;
  duplicados: number;
  semEmail: number;
  falhas: { itemId: string; erro: string }[];
};

/**
 * Itens cujo prazo vigente vence HOJE e que ainda não foram entregues.
 *
 * "Prazo vigente" é `prazo_reprogramado ?? prazo_previsto` — a mesma
 * regra de derivarStatus (lib/ui/status.ts). Reprogramar precisa mover
 * o aviso junto, senão o projetista seria cobrado por uma data que a
 * equipe já abandonou.
 *
 * Ficam de fora:
 *  · itens com prazo_realizado (já entregues, ainda que o status não
 *    tenha sido movido na mão — mesma tolerância de derivarStatus);
 *  · 'finalizado' e 'em_analise': o item está com a equipe, não com o
 *    projetista, e cobrá-lo de um prazo que não depende mais dele só
 *    ensina a ignorar o aviso.
 */
export async function itensQueVencemHoje(hoje: string) {
  const vigente = sql<string>`coalesce(${itensProjeto.prazoReprogramado}, ${itensProjeto.prazoPrevisto})`;

  return db
    .select({
      id: itensProjeto.id,
      itemNumero: itensProjeto.item,
      planta: itensProjeto.planta,
      prazo: vigente,
      empreendimento: empreendimentos.nome,
      disciplina: disciplinas.nome,
      etapa: etapas.nome,
      projetistaNome: projetistas.nome,
      projetistaEmail: projetistas.email,
    })
    .from(itensProjeto)
    .innerJoin(empreendimentos, eq(empreendimentos.id, itensProjeto.empreendimentoId))
    .innerJoin(disciplinas, eq(disciplinas.id, itensProjeto.disciplinaId))
    .innerJoin(etapas, eq(etapas.id, itensProjeto.etapaId))
    // innerJoin: item sem projetista não tem a quem avisar.
    .innerJoin(projetistas, eq(projetistas.id, itensProjeto.projetistaId))
    .where(
      and(
        sql`${vigente} = ${hoje}::date`,
        isNull(itensProjeto.prazoRealizado),
        ne(itensProjeto.status, "finalizado"),
        ne(itensProjeto.status, "em_analise"),
        // Sem e-mail não há envio; filtrar aqui evita contar como
        // "encontrado" o que nunca poderia sair.
        sql`nullif(btrim(${projetistas.email}), '') is not null`,
      ),
    );
}

/**
 * A varredura das 08h. Idempotente: a referência do envio é a DATA do
 * prazo, então rodar duas vezes no mesmo dia não duplica nada — o
 * segundo passe volta inteiro como `duplicados`.
 */
export async function dispararAvisosDeVencimento(): Promise<ResumoVarredura> {
  const hoje = hojeISORecife();
  const itens = await itensQueVencemHoje(hoje);

  const resumo: ResumoVarredura = {
    data: hoje,
    encontrados: itens.length,
    enviados: 0,
    duplicados: 0,
    semEmail: 0,
    falhas: [],
  };

  // Sequencial de propósito: o transporter tem pool de 1 conexão e o
  // provedor limita rajadas. Paralelizar aqui trocaria alguns segundos
  // por mensagens recusadas.
  for (const it of itens) {
    const mensagem = mensagemVencimento({
      projetistaNome: it.projetistaNome,
      empreendimento: it.empreendimento,
      disciplina: it.disciplina,
      etapa: it.etapa,
      itemNumero: it.itemNumero,
      planta: it.planta,
      prazoBR: formatBR(it.prazo),
    });

    const r = await enviarEmail({
      tipo: "vencimento_hoje",
      itemId: it.id,
      // A data do prazo é a chave: um aviso por item por data de prazo.
      referencia: it.prazo,
      destinatario: it.projetistaEmail,
      mensagem,
      contexto: {
        projetistaNome: it.projetistaNome,
        empreendimentoNome: it.empreendimento,
        itemNumero: it.itemNumero,
      },
    });

    if (r.estado === "enviado") resumo.enviados++;
    else if (r.estado === "duplicado") resumo.duplicados++;
    else if (r.estado === "sem_email") resumo.semEmail++;
    else resumo.falhas.push({ itemId: it.id, erro: r.erro });
  }

  return resumo;
}
