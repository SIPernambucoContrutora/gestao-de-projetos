import { listEmpreendimentos } from "@/lib/actions/empreendimentos";
import type { EmpreendimentoComProgresso } from "@/lib/actions/empreendimentos";
import { AuthError, getCurrentUserWithRole } from "@/lib/auth/session";
import { NovoEmpreendimentoButton } from "../_components/NovoEmpreendimentoButton";
import { EmpreendimentosView } from "../_components/EmpreendimentosView";

export const metadata = { title: "Empreendimentos — Gestão de Projetos" };

export default async function EmpreendimentosPage() {
  let emps: EmpreendimentoComProgresso[] = [];
  let podeEditar = false;
  let authNeeded = false;
  try {
    const [lista, ctx] = await Promise.all([listEmpreendimentos(), getCurrentUserWithRole()]);
    emps = lista;
    podeEditar = ctx?.papel === "admin" || ctx?.papel === "equipe";
  } catch (e) {
    if (e instanceof AuthError) authNeeded = true;
    else throw e;
  }

  return (
    <div>
      <header className="page-head">
        <div className="page-head__row">
          <div>
            <h1 className="page-head__title">Empreendimentos</h1>
            <p className="page-head__sub">
              {authNeeded
                ? "Acompanhamento de projetos técnicos"
                : `${emps.length} ${emps.length === 1 ? "empreendimento ativo" : "empreendimentos ativos"}`}
            </p>
          </div>
          {podeEditar && <NovoEmpreendimentoButton />}
        </div>
      </header>

      {authNeeded ? (
        <div className="empty-state">
          Entre com sua conta para ver os empreendimentos.
        </div>
      ) : emps.length === 0 ? (
        <div className="empty-state">
          Nenhum empreendimento cadastrado ainda. Clique em “Novo empreendimento” para começar.
        </div>
      ) : (
        <EmpreendimentosView emps={emps} />
      )}
    </div>
  );
}
