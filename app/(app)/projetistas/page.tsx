import { listProjetistas } from "@/lib/actions/projetistas";
import type { Projetista } from "@/db/schema";
import { AuthError, getCurrentUserWithRole } from "@/lib/auth/session";
import { NovoProjetistaButton } from "../_components/NovoProjetistaButton";
import { ProjetistasTable } from "../_components/ProjetistasTable";

export const metadata = { title: "Projetistas — Gestão das Obras" };

export default async function ProjetistasPage() {
  let projetistas: Projetista[] = [];
  let podeEditar = false;
  let authNeeded = false;

  try {
    const [lista, ctx] = await Promise.all([listProjetistas(), getCurrentUserWithRole()]);
    projetistas = lista;
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
            <h1 className="page-head__title">Projetistas</h1>
            <p className="page-head__sub">
              {authNeeded
                ? "Cadastro de projetistas vinculados aos itens de projeto"
                : `${projetistas.length} ${projetistas.length === 1 ? "projetista cadastrado" : "projetistas cadastrados"}`}
            </p>
          </div>
          {podeEditar && <NovoProjetistaButton />}
        </div>
      </header>

      {authNeeded ? (
        <div className="empty-state">Entre com sua conta para ver os projetistas.</div>
      ) : projetistas.length === 0 ? (
        <div className="empty-state">
          Nenhum projetista cadastrado ainda. Clique em "Novo projetista" para começar.
        </div>
      ) : (
        <section style={{ padding: "0 28px 48px" }}>
          <ProjetistasTable
            projetistas={projetistas}
            podeEditar={podeEditar}
            hojeISO={new Date().toISOString().slice(0, 10)}
          />
        </section>
      )}
    </div>
  );
}
