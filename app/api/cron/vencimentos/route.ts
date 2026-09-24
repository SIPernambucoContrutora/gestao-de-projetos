import { timingSafeEqual } from "node:crypto";
import { dispararAvisosDeAprovacao } from "@/lib/email/aprovacoes";
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
 * Avisos diários de vencimento — chamado por um agendador EXTERNO. Duas
 * varreduras: prazos de itens (ao projetista) e aprovações de
 * empreendimentos na Prefeitura (aos usuários com papel 'equipe').
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

  // Em sequência (o transporter limita a taxa) e isoladas: uma varredura
  // que quebra não pode impedir a outra de avisar.
  const prazos = await executar("prazos", dispararAvisosDeVencimento);
  const aprovacoes = await executar("aprovacoes", dispararAvisosDeAprovacao);

  // 200 mesmo com falhas parciais de envio: o cron não deve reexecutar por
  // causa de um endereço inválido — a idempotência tornaria o retry
  // inócuo de qualquer forma, e o resumo já reporta o que falhou.
  const ok = prazos.ok && aprovacoes.ok;
  return Response.json({ ok, prazos, aprovacoes }, { status: ok ? 200 : 500 });
}

async function executar<T extends object>(
  nome: string,
  varredura: () => Promise<T>,
): Promise<({ ok: true } & T) | { ok: false; erro: string }> {
  try {
    return { ok: true, ...(await varredura()) };
  } catch (e) {
    console.error(`[cron/vencimentos] ${nome} falhou:`, e);
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
