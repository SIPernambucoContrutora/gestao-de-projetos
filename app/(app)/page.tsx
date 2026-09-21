import { listTodosItens } from "@/lib/actions/itens";
import type { ItemDashboard } from "@/lib/actions/itens";
import { AuthError } from "@/lib/auth/session";
import { hojeISORecife } from "@/lib/ui/status";
import { DashboardBoard } from "./_components/DashboardBoard";

export const metadata = { title: "Dashboard — Gestão de Projetos" };

export default async function DashboardPage() {
  let itens: ItemDashboard[] = [];
  let authNeeded = false;
  try {
    itens = await listTodosItens();
  } catch (e) {
    if (e instanceof AuthError) authNeeded = true;
    else throw e;
  }

  if (authNeeded) {
    return (
      <div>
        <header className="page-head">
          <h1 className="page-head__title">Dashboard</h1>
          <p className="page-head__sub">Visão consolidada dos itens de projeto</p>
        </header>
        <div className="empty-state">Entre com sua conta para ver o dashboard.</div>
      </div>
    );
  }

  // No fuso de Recife, não em UTC: entre 21h e a meia-noite, toISOString()
  // já estaria no dia seguinte e o painel marcaria itens como atrasados um
  // dia antes da hora. O resto do app usa esta mesma referência.
  return <DashboardBoard itens={itens} hojeISO={hojeISORecife()} />;
}
