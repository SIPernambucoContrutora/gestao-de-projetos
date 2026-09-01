// scripts/testar-email.mjs
// ------------------------------------------------------------------
// Valida a configuração de e-mail ANTES de a feature entrar em produção.
//
// A configuração OAuth app-only tem duas metades que falham de formas
// diferentes, e o script as testa SEPARADAMENTE de propósito:
//
//   1) Entra ID emite o token?  → tenant/client/segredo corretos
//   2) O Exchange aceita o token? → New-ServicePrincipal e
//      Add-MailboxPermission feitos na caixa certa
//
// Essa separação é o ponto do script: a metade 2 falha com
// "535 5.7.3 Authentication unsuccessful", que se parece com credencial
// errada mas quase sempre é permissão de mailbox faltando. Sem saber que
// o token saiu, você procuraria o problema no lugar errado.
//
// Uso (PowerShell):
//   node scripts/testar-email.mjs
//   node scripts/testar-email.mjs voce@dominio.com
//
// Lê AZURE_* e SMTP_FROM do .env.
// ------------------------------------------------------------------
import "dotenv/config";
import nodemailer from "nodemailer";

const faltando = [
  "AZURE_TENANT_ID",
  "AZURE_CLIENT_ID",
  "AZURE_CLIENT_SECRET",
  "SMTP_FROM",
].filter((k) => !process.env[k]);

if (faltando.length) {
  console.error(`Faltam no .env: ${faltando.join(", ")}`);
  process.exit(1);
}

const caixa = process.env.SMTP_FROM;
const porta = Number(process.env.SMTP_PORT ?? 587);
const host = process.env.SMTP_HOST ?? "smtp.office365.com";
const destino = process.argv[2];

/* --- 1) Token ---------------------------------------------------- */

console.log("[1/3] Pedindo token ao Entra ID...");

const resp = await fetch(
  `https://login.microsoftonline.com/${encodeURIComponent(process.env.AZURE_TENANT_ID)}/oauth2/v2.0/token`,
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET,
      scope: "https://outlook.office365.com/.default",
      grant_type: "client_credentials",
    }),
  },
);

const dados = await resp.json();

if (!resp.ok || !dados.access_token) {
  console.error(`      FALHOU (${resp.status}): ${dados.error_description ?? dados.error}`);
  console.error(
    "\nPistas pelo código AADSTS na mensagem acima:\n" +
      "  · AADSTS7000215 → segredo errado. Confira se copiou o VALOR do\n" +
      "    segredo, não o ID do segredo (o portal mostra os dois lado a lado).\n" +
      "  · AADSTS7000222 → o segredo EXPIROU. Gere outro no registro do app.\n" +
      "  · AADSTS700016  → client_id não existe nesse tenant.\n" +
      "  · AADSTS900023  → tenant_id errado.",
  );
  process.exit(1);
}

console.log(`      OK — token emitido, expira em ${dados.expires_in}s.`);

/* --- 2) O Exchange aceita o token nessa caixa? -------------------- */

console.log(`[2/3] Autenticando em ${host}:${porta} como ${caixa}...`);

const transporter = nodemailer.createTransport({
  host,
  port: porta,
  secure: porta === 465,
  auth: { type: "OAuth2", user: caixa, accessToken: dados.access_token },
});

try {
  await transporter.verify();
  console.log("      OK — o Exchange aceitou o token para essa caixa.");
} catch (e) {
  console.error(`      FALHOU: ${e.message}`);
  console.error(
    "\nO token FOI emitido, então o problema não é o segredo nem o app —\n" +
      "está do lado do Exchange Online:\n" +
      "  · 535 5.7.3 → falta New-ServicePrincipal (registrar o app no Exchange)\n" +
      "    ou Add-MailboxPermission -AccessRights FullAccess nesta caixa.\n" +
      "    Atenção ao ObjectId: é o da ENTERPRISE APPLICATION, não o do\n" +
      "    registro do app — usar o errado falha exatamente assim.\n" +
      "  · Confira também se a permissão SMTP.SendAsApp (Application, não\n" +
      "    Delegated) recebeu consentimento do admin.",
  );
  process.exit(1);
}

/* --- 3) Envio real ----------------------------------------------- */

if (!destino) {
  console.log("\n[3/3] Nenhum destinatário informado — nada foi enviado.");
  console.log("Para mandar um teste real: node scripts/testar-email.mjs voce@dominio.com");
  process.exit(0);
}

console.log(`[3/3] Enviando para ${destino}...`);

try {
  const info = await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NOME ?? "Gestão das Obras"}" <${caixa}>`,
    to: destino,
    subject: "[Gestão das Obras] Teste de configuração de e-mail",
    text:
      "Se você está lendo isto, o envio do painel Gestão das Obras está funcionando.\n\n" +
      "Mensagem gerada por scripts/testar-email.mjs.",
  });
  console.log(`      OK — messageId: ${info.messageId}`);
  console.log("\nConfira a caixa de SPAM também.");
} catch (e) {
  console.error(`      FALHOU no envio: ${e.message}`);
  console.error(
    "\nAutenticou mas não enviou. Provável SendAs: se o From não for a\n" +
      "própria caixa autenticada, é preciso Add-RecipientPermission.",
  );
  process.exit(1);
}

process.exit(0);
