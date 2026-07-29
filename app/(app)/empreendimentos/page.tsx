import Link from "next/link";
import { listEmpreendimentos } from "@/lib/actions/empreendimentos";
import type { EmpreendimentoComProgresso } from "@/lib/actions/empreendimentos";
import { AuthError, getCurrentUserWithRole } from "@/lib/auth/session";
import { NovoEmpreendimentoButton } from "../_components/NovoEmpreendimentoButton";

export const metadata = { title: "Empreendimentos — Gestão das Obras" };

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
        <section className="emp-grid">
          {emps.map((e) => (
            <EmpreendimentoCard key={e.id} emp={e} />
          ))}
        </section>
      )}
    </div>
  );
}

function EmpreendimentoCard({ emp }: { emp: EmpreendimentoComProgresso }) {
  return (
    <Link href={`/empreendimentos/${emp.id}`} className="card-item">
      <div className="card-item__top">
        <div className="card-item__name">{emp.nome}</div>
      </div>
      <div className="card-item__meta">{emp.responsavel ?? "Sem responsável"}</div>

      <div className="card-item__progress-row">
        <span>
          {emp.itensFinalizados}/{emp.totalItens} itens finalizados
        </span>
        <span className="card-item__pct">{emp.progresso}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${emp.progresso}%` }} />
      </div>

      <div className="card-item__badges">
        <span className="badge badge--ambar">
          <span className="badge__dot" />
          {emp.itensEmAndamento} em andamento
        </span>
        <span className={`badge badge--${emp.itensAtrasados > 0 ? "vermelho" : "cinza"}`}>
          <span className="badge__dot" />
          {emp.itensAtrasados} atrasados
        </span>
      </div>
    </Link>
  );
}
