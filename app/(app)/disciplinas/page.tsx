import { listDisciplinasAdmin } from "@/lib/actions/disciplinas";
import type { Disciplina } from "@/db/schema";
import { AuthError, getCurrentUserWithRole } from "@/lib/auth/session";
import { NovaDisciplinaButton } from "../_components/NovaDisciplinaButton";
import { DisciplinasTable } from "../_components/DisciplinasTable";

export const metadata = { title: "Disciplinas — Gestão de Projetos" };

export default async function DisciplinasPage() {
  let disciplinas: Disciplina[] = [];
  let podeEditar = false;
  let authNeeded = false;

  try {
    const [lista, ctx] = await Promise.all([listDisciplinasAdmin(), getCurrentUserWithRole()]);
    disciplinas = lista;
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
            <h1 className="page-head__title">Disciplinas</h1>
            <p className="page-head__sub">
              {authNeeded
                ? "Cadastro de disciplinas e sua categoria (Obra ou Lançamento)"
                : `${disciplinas.length} ${disciplinas.length === 1 ? "disciplina cadastrada" : "disciplinas cadastradas"}`}
            </p>
          </div>
          {podeEditar && <NovaDisciplinaButton />}
        </div>
      </header>

      {authNeeded ? (
        <div className="empty-state">Entre com sua conta para ver as disciplinas.</div>
      ) : disciplinas.length === 0 ? (
        <div className="empty-state">
          Nenhuma disciplina cadastrada ainda. Clique em "Nova disciplina" para começar.
        </div>
      ) : (
        <section style={{ padding: "0 28px 48px" }}>
          <DisciplinasTable disciplinas={disciplinas} podeEditar={podeEditar} />
        </section>
      )}
    </div>
  );
}
