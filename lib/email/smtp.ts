import "@/lib/server-only-guard";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/**
 * Transporte SMTP da caixa institucional
 * (gestaodeprojetos@pernambucoconstrutora.com.br), autenticado por
 * OAuth2 no fluxo client credentials (app-only).
 *
 * NÃO usa usuário e senha de propósito: a Microsoft desativa o SMTP AUTH
 * com Basic Auth por padrão nos tenants existentes no fim de dezembro de
 * 2026, com remoção definitiva anunciada para 2027. OAuth é o caminho
 * que atravessa essa data.
 *
 * App-only (sem usuário logado) é o fluxo certo aqui: quem manda é um
 * cron às 08h, não uma pessoa — não há a quem pedir consentimento
 * interativo nem refresh token para renovar.
 *
 * A configuração do lado da Microsoft está no README: sem o
 * New-ServicePrincipal e o Add-MailboxPermission no Exchange Online, o
 * token é emitido normalmente mas o servidor recusa com 535 5.7.3 —
 * falha que parece credencial errada e não é.
 */

const ESCOPO = "https://outlook.office365.com/.default";
// Renova antes do vencimento real: um token que expira no meio da rajada
// das 08h derrubaria a metade final dos avisos.
const MARGEM_MS = 5 * 60_000;

function exigir(nome: string): string {
  const v = process.env[nome];
  if (!v) {
    throw new Error(
      `${nome} não definida. O envio de e-mail depende dela — veja .env.example.`,
    );
  }
  return v;
}

/** A caixa que envia. É também o `user` do XOAUTH2. */
export function caixaRemetente(): string {
  return exigir("SMTP_FROM");
}

/** Remetente exibido nas mensagens. */
export function remetente(): string {
  const nome = process.env.SMTP_FROM_NOME ?? "Gestão das Obras";
  return `"${nome}" <${caixaRemetente()}>`;
}

type Token = { valor: string; expiraEm: number };

let tokenCache: Token | null = null;

async function obterToken(): Promise<Token> {
  if (tokenCache && Date.now() < tokenCache.expiraEm - MARGEM_MS) {
    return tokenCache;
  }

  const tenant = exigir("AZURE_TENANT_ID");
  const corpo = new URLSearchParams({
    client_id: exigir("AZURE_CLIENT_ID"),
    client_secret: exigir("AZURE_CLIENT_SECRET"),
    scope: ESCOPO,
    grant_type: "client_credentials",
  });

  const resp = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: corpo,
    },
  );

  const dados = (await resp.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!resp.ok || !dados.access_token) {
    // A error_description da Microsoft traz o código AADSTS, que é o que
    // de fato identifica a causa (segredo expirado, permissão sem
    // consentimento, tenant errado). Propagar só "401" esconderia isso.
    throw new Error(
      `Falha ao obter token OAuth (${resp.status}): ${dados.error_description ?? dados.error ?? "resposta inesperada"}`,
    );
  }

  tokenCache = {
    valor: dados.access_token,
    expiraEm: Date.now() + (dados.expires_in ?? 3600) * 1000,
  };
  return tokenCache;
}

let transporterCache: { t: Transporter; expiraEm: number } | null = null;

/**
 * Transporter válido agora. Reaproveitado enquanto o token durar: cada
 * `createTransport` refaz handshake TLS, e o aviso diário manda uma
 * mensagem por item.
 */
export async function getTransporter(): Promise<Transporter> {
  const token = await obterToken();

  if (transporterCache && transporterCache.expiraEm === token.expiraEm) {
    return transporterCache.t;
  }

  // Token novo: o pool antigo carrega o token velho nas conexões que já
  // abriu. Fechar evita que uma conexão reciclada autentique com o que
  // expirou.
  transporterCache?.t.close();

  const porta = Number(process.env.SMTP_PORT ?? 587);

  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.office365.com",
    port: porta,
    // 587 abre em texto claro e sobe para TLS via STARTTLS; 465 é TLS
    // implícito. O Exchange Online usa 587.
    secure: porta === 465,
    auth: {
      type: "OAuth2",
      user: caixaRemetente(),
      // Token já obtido: o nodemailer só monta o SASL XOAUTH2 e envia.
      // Sem accessUrl/refreshToken — no fluxo app-only não há refresh
      // token, a renovação é pedir outro token com o mesmo segredo.
      accessToken: token.valor,
    },
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    // Teto de 20 mensagens por MINUTO, calibrado para o Exchange Online:
    // o client submission da Microsoft corta em 30/minuto, e estourar o
    // limite devolve 4.7.x no meio da rajada — ou seja, o aviso das 08h
    // sairia pela metade, com os itens do fim da fila silenciosamente
    // sem e-mail. A margem cobre variação de contagem do lado deles.
    rateDelta: 60_000,
    rateLimit: 20,
  });

  transporterCache = { t, expiraEm: token.expiraEm };
  return t;
}
