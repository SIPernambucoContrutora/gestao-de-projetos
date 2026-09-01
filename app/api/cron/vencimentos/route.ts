import { timingSafeEqual } from "node:crypto";
import { dispararAvisosDeVencimento } from "@/lib/email/vencimentos";

// nodemailer abre socket TCP: precisa do runtime Node, não do Edge.
export const runtime = "nodejs";
// A rota consulta o banco e manda e-mail a cada chamada — cachear seria
// servir o resumo de ontem e não mandar nada hoje.
export const dynamic = "force-dynamic";
// Rajada de e-mails, um por vez: o default de 10s do plano Hobby estoura
// com poucos itens. O teto do Hobby é 60s; o Pro aceita mais.
export const maxDuration = 60;

/**
 * Aviso diário de vencimento — chamado por um agendador EXTERNO.
 *
 * Ser uma rota HTTP em vez de um agendador embutido é deliberado: hoje
 * quem chama é o Vercel Cron (vercel.json), e na migração para a VPS
 * passa a ser o cron do sistema com um curl para esta mesma URL. A
 * lógica não muda junto com a hospedagem.
 *
 * Autenticação por token no header, não por sessão: não há usuário
 * logado num cron. O Vercel Cron envia `Authorization: Bearer
 * $CRON_SECRET` automaticamente quando a variável existe no projeto.
 */
function autorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  // Sem segredo configurado a rota fica FECHADA. O contrário — abrir por
  // falta de configuração — deixaria qualquer um na internet disparando
  // e-mails em nome da empresa.
  if (!segredo) return false;

  const header = req.headers.get("authorization") ?? "";
  const enviado = header.startsWith("Bearer ") ? header.slice(7) : "";

  const a = Buffer.from(enviado);
  const b = Buffer.from(segredo);
  // timingSafeEqual exige mesmo tamanho; o length já vaza pouco e a
  // comparação de tamanho antes evita a exceção.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!autorizado(req)) {
    return Response.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const resumo = await dispararAvisosDeVencimento();
    // 200 mesmo com falhas parciais: o cron não deve reexecutar por
    // causa de um endereço inválido — a idempotência tornaria o retry
    // inócuo de qualquer forma, e o resumo já reporta o que falhou.
    return Response.json({ ok: true, ...resumo });
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error("[cron/vencimentos] falhou:", e);
    return Response.json({ ok: false, erro }, { status: 500 });
  }
}
