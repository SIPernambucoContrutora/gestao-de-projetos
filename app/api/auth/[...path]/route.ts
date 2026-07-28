import { auth } from "@/lib/auth/server";

// Proxy das rotas do Neon Auth (login, sessão, etc).
const handlers = auth.handler();

export const GET = handlers.GET;

// Cadastro público DESABILITADO: novos usuários são criados apenas pela tela de
// admin (lib/actions/usuarios.ts → createUsuario, que fala direto com o Neon
// Auth). Aqui bloqueamos qualquer tentativa de sign-up via o proxy do browser.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const rota = Array.isArray(path) ? path.join("/") : String(path ?? "");
  if (rota.startsWith("sign-up")) {
    return Response.json(
      { code: "SIGNUP_DISABLED", message: "Cadastro desabilitado. Peça a um administrador." },
      { status: 403 },
    );
  }
  return handlers.POST(request, ctx);
}
