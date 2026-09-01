import "@/lib/server-only-guard";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailsEnviados } from "@/db/schema";
import type { TipoEmail } from "@/db/schema";
import { getTransporter, remetente } from "./smtp";
import type { Mensagem } from "./templates";

export type ResultadoEnvio =
  | { estado: "enviado"; id: string }
  | { estado: "duplicado" } // já havia registro para (tipo, item, referência)
  | { estado: "sem_email" } // projetista sem e-mail cadastrado
  | { estado: "falhou"; erro: string };

export type PedidoEnvio = {
  tipo: TipoEmail;
  itemId: string;
  /** O que torna o envio único dentro do tipo (data do prazo, id da revisão). */
  referencia: string;
  destinatario: string | null | undefined;
  mensagem: Mensagem;
  contexto: {
    projetistaNome?: string | null;
    empreendimentoNome?: string | null;
    itemNumero?: number | null;
  };
};

/**
 * Envia uma mensagem e registra a tentativa.
 *
 * A ordem importa: a linha em emails_enviados é gravada ANTES de falar
 * com o SMTP. Se o registro fosse depois, duas execuções simultâneas do
 * cron (retry da plataforma sobrepondo a execução original) passariam
 * as duas pela verificação e mandariam o e-mail duas vezes — o índice
 * único só protege se a escrita vier primeiro. O INSERT com
 * ON CONFLICT DO NOTHING é, ele mesmo, a trava: quem não conseguir
 * inserir sabe que outro já assumiu o envio.
 *
 * NUNCA lança. Um SMTP fora do ar não pode derrubar a abertura de uma
 * revisão nem interromper a varredura diária no meio — a falha vira a
 * coluna `erro` e o resultado devolvido.
 */
export async function enviarEmail(p: PedidoEnvio): Promise<ResultadoEnvio> {
  const destinatario = p.destinatario?.trim();
  if (!destinatario) return { estado: "sem_email" };

  const id = crypto.randomUUID();

  // Reivindica o envio. Vazio = outra execução chegou antes.
  const reivindicado = await db
    .insert(emailsEnviados)
    .values({
      id,
      tipo: p.tipo,
      itemId: p.itemId,
      referencia: p.referencia,
      destinatario,
      assunto: p.mensagem.assunto,
      projetistaNome: p.contexto.projetistaNome ?? null,
      empreendimentoNome: p.contexto.empreendimentoNome ?? null,
      itemNumero: p.contexto.itemNumero ?? null,
    })
    .onConflictDoNothing({
      target: [emailsEnviados.tipo, emailsEnviados.itemId, emailsEnviados.referencia],
    })
    .returning({ id: emailsEnviados.id });

  if (reivindicado.length === 0) return { estado: "duplicado" };

  try {
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: remetente(),
      to: destinatario,
      subject: p.mensagem.assunto,
      text: p.mensagem.texto,
      html: p.mensagem.html,
    });
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    // A linha fica com enviado_em nulo e o erro preenchido: o envio
    // aparece como falho em vez de sumir do registro.
    await db
      .update(emailsEnviados)
      .set({ erro })
      .where(eq(emailsEnviados.id, id));
    return { estado: "falhou", erro };
  }

  await db
    .update(emailsEnviados)
    .set({ enviadoEm: new Date(), erro: null })
    .where(eq(emailsEnviados.id, id));

  return { estado: "enviado", id };
}

/**
 * Envio "dispare e siga", para uso dentro de Server Actions.
 *
 * A abertura da revisão já está COMMITADA quando isto roda: o e-mail é
 * consequência, não parte da transação. Se o SMTP falhar, a revisão
 * continua válida e a falha fica em emails_enviados — o inverso
 * (desfazer a revisão porque o e-mail não saiu) seria pior.
 */
export async function enviarSemBloquear(p: PedidoEnvio): Promise<void> {
  try {
    const r = await enviarEmail(p);
    if (r.estado === "falhou") {
      console.error(`[email] ${p.tipo} item=${p.itemId} falhou: ${r.erro}`);
    }
  } catch (e) {
    // Rede/banco fora do ar no meio do registro. Não propaga.
    console.error(`[email] ${p.tipo} item=${p.itemId} erro inesperado:`, e);
  }
}

