import type { PapelUsuario } from "@/db/schema";
import { getCurrentUserWithRole } from "@/lib/auth/session";
import { Sidebar } from "./_components/Sidebar";

const ROTULO_PAPEL: Record<PapelUsuario, string> = {
  admin: "Admin",
  equipe: "Equipe",
  leitura: "Leitura",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Resiliente: se o Neon Auth ainda não estiver provisionado, o shell renderiza
  // com um usuário placeholder em vez de derrubar a árvore inteira.
  let userName = "Convidado";
  let userRole = "—";
  try {
    const ctx = await getCurrentUserWithRole();
    if (ctx) {
      userName = ctx.user.name || ctx.user.email || "Usuário";
      userRole = ROTULO_PAPEL[ctx.papel];
    }
  } catch {
    /* auth indisponível — segue com placeholder */
  }

  return (
    <div className="app-shell">
      <Sidebar userName={userName} userRole={userRole} />
      <main className="main">{children}</main>
    </div>
  );
}
