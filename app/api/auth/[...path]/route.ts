import { auth } from "@/lib/auth/server";

// Proxy de TODAS as rotas do Neon Auth (login, sessão, callback, etc).
export const { GET, POST } = auth.handler();
