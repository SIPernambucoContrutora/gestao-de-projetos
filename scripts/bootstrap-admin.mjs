// scripts/bootstrap-admin.mjs
// ------------------------------------------------------------------
// Cria o PRIMEIRO usuário admin (bootstrap) quando ainda não há nenhum.
// Necessário porque a tela de Usuários exige um admin, e o cadastro público
// está bloqueado — então o primeiro é criado aqui, direto no Neon Auth.
//
// Uso (PowerShell), definindo a senha você mesmo:
//   $env:ADMIN_EMAIL="voce@dominio.com"
//   $env:ADMIN_NAME="Seu Nome"
//   $env:ADMIN_PASS="uma-senha-forte-8+"
//   node scripts/bootstrap-admin.mjs
//
// Lê DATABASE_URL e NEON_AUTH_BASE_URL do .env.
// ------------------------------------------------------------------
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const base = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, "");
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim() || email;
const senha = process.env.ADMIN_PASS;
const origin = process.env.ADMIN_ORIGIN || "http://localhost:3000";

if (!process.env.DATABASE_URL || !base) {
  console.error("Faltam DATABASE_URL e/ou NEON_AUTH_BASE_URL no .env.");
  process.exit(1);
}
if (!email || !senha) {
  console.error("Defina ADMIN_EMAIL e ADMIN_PASS (e opcionalmente ADMIN_NAME).");
  process.exit(1);
}
if (senha.length < 8) {
  console.error("A senha precisa de ao menos 8 caracteres.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// 1) Cria o usuário no Neon Auth (com senha). Se já existir, seguimos adiante.
const res = await fetch(`${base}/sign-up/email`, {
  method: "POST",
  headers: { "content-type": "application/json", Origin: origin },
  body: JSON.stringify({ email, password: senha, name }),
});
const data = await res.json().catch(() => ({}));
let userId = data?.user?.id;

if (!res.ok) {
  console.log(`sign-up: status ${res.status} — ${data?.message || "(sem mensagem)"}`);
}

// 2) Se não veio id (ex.: já existia), busca no banco.
if (!userId) {
  const [u] = await sql`select id from neon_auth.user where email = ${email}`;
  userId = u?.id;
}
if (!userId) {
  console.error("Não foi possível criar nem localizar o usuário. Verifique o erro acima.");
  process.exit(1);
}

// 3) Promove a admin (least-privilege é o default; aqui forçamos admin).
await sql`
  insert into usuarios_papel (usuario_id, papel)
  values (${userId}, 'admin')
  on conflict (usuario_id) do update set papel = 'admin', updated_at = now()
`;

console.log("\n✅ Admin pronto!");
console.log("   e-mail:", email);
console.log("   id    :", userId);
console.log("   Faça login com este e-mail e a senha definida.");
