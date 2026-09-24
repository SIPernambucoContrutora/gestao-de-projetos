import "@/lib/server-only-guard";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { neonAuthUser } from "@/db/neonAuth";
import { empreendimentos, usuariosPapel } from "@/db/schema";
import { diasEntreISO, inicioAvisoAprovacao, vencimentoAprovacao } from "@/lib/ui/aprovacao";
import { formatBR, hojeISORecife } from "@/lib/ui/status";
import { enviarEmail } from "./enviar";
import { mensagemAprovacaoVencendo } from "./templates";

export type ResumoAprovacoes = {
  data: string;
  encontrados: number;
  enviados: number;
  duplicados: number;
  semDestinatario: number;
  falhas: { empreendimentoId: string; erro: string }[];
};

/**
 * Quem recebe o aviso: todos os usuários com papel 'equipe' (não o
 * projetista). Lido a cada execução, então mudar o papel de alguém na tela
 * de Usuários já vale para o aviso seguinte.
 */
async function emailsDaEquipe(): Promise<string> {
  const rows = await db
    .select({ email: neonAuthUser.email })
    .from(usuariosPapel)
    // usuario_id é text; neon_auth.user.id é uuid → cast explícito no join.
    .innerJoin(neonAuthUser, sql`${usuariosPapel.usuarioId} = ${neonAuthUser.id}::text`)
    .where(
      and(
        eq(usuariosPapel.papel, "equipe"),
        sql`nullif(btrim(${neonAuthUser.email}), '') is not null`,
      ),
    );
  return [...new Set(rows.map((r) => r.email!.trim().toLowerCase()))].join(", ");
}

/**
 * Empreendimentos ainda "Aprovado" cuja aprovação já completou 10 meses e
 * ainda não venceu (1 ano).
 *
 * "Já completou", não "completa hoje": um dia sem cron, ou uma data de
 * aprovação lançada com atraso, não pode engolir o aviso. Quem impede a
 * repetição é a referência do envio (um aviso por aprovação). Depois do
 * vencimento o texto ("possui vencimento previsto para…") deixaria de ser
 * verdade, então não sai mais.
 *
 * O filtro de datas roda aqui e não no SQL para usar a mesma aritmética de
 * meses da tela (lib/ui/aprovacao.ts) — são poucas linhas.
 */
export async function empreendimentosComAprovacaoVencendo(hoje: string) {
  const aprovados = await db
    .select({
      id: empreendimentos.id,
      nome: empreendimentos.nome,
      dataAprovacao: empreendimentos.dataAprovacao,
    })
    .from(empreendimentos)
    .where(and(eq(empreendimentos.fase, "aprovado"), isNotNull(empreendimentos.dataAprovacao)));

  return aprovados.flatMap((e) => {
    const dataAprovacao = e.dataAprovacao!;
    const vencimento = vencimentoAprovacao(dataAprovacao);
    if (hoje < inicioAvisoAprovacao(dataAprovacao) || hoje > vencimento) return [];
    return [{ id: e.id, nome: e.nome, dataAprovacao, vencimento, diasRestantes: diasEntreISO(hoje, vencimento) }];
  });
}

/** Varredura diária, junto com a dos prazos (mesma rota de cron). Idempotente. */
export async function dispararAvisosDeAprovacao(): Promise<ResumoAprovacoes> {
  const hoje = hojeISORecife();
  const alvos = await empreendimentosComAprovacaoVencendo(hoje);
  const para = alvos.length > 0 ? await emailsDaEquipe() : "";

  const resumo: ResumoAprovacoes = {
    data: hoje,
    encontrados: alvos.length,
    enviados: 0,
    duplicados: 0,
    semDestinatario: 0,
    falhas: [],
  };

  for (const e of alvos) {
    const r = await enviarEmail({
      tipo: "aprovacao_vencendo",
      itemId: null,
      // Uma nova aprovação (voltou a "Em estudo" e foi reaprovado) tem outra
      // data, portanto outra referência — e ganha o próprio aviso.
      referencia: `${e.id}:${e.dataAprovacao}`,
      destinatario: para,
      mensagem: mensagemAprovacaoVencendo({
        empreendimento: e.nome,
        dataAprovacaoBR: formatBR(e.dataAprovacao),
        vencimentoBR: formatBR(e.vencimento),
        diasRestantes: e.diasRestantes,
      }),
      contexto: { empreendimentoNome: e.nome },
    });

    if (r.estado === "enviado") resumo.enviados++;
    else if (r.estado === "duplicado") resumo.duplicados++;
    else if (r.estado === "sem_email") resumo.semDestinatario++;
    else resumo.falhas.push({ empreendimentoId: e.id, erro: r.erro });
  }

  if (resumo.semDestinatario > 0) {
    console.warn(
      `[email] aprovacao_vencendo: ${resumo.semDestinatario} aviso(s) sem destinatário — nenhum usuário com papel 'equipe' e e-mail.`,
    );
  }

  return resumo;
}
