import Link from "next/link";
import { notFound } from "next/navigation";
import { getEmpreendimento } from "@/lib/actions/empreendimentos";
import { listItensPorEmpreendimento } from "@/lib/actions/itens";
import type { ItemComRefs } from "@/lib/actions/itens";
import { listDisciplinas, listEtapas } from "@/lib/actions/listas";
import { listProjetistas } from "@/lib/actions/projetistas";
import { listUsuariosBasico } from "@/lib/actions/usuarios";
import type { UsuarioBasico } from "@/lib/actions/usuarios";
import type { Disciplina, Etapa, Projetista } from "@/db/schema";
import type { EmpreendimentoComProgresso } from "@/lib/actions/empreendimentos";
import { AuthError, getCurrentUserWithRole } from "@/lib/auth/session";
import { ItensBoard } from "../../_components/ItensBoard";
import { ExcluirEmpreendimentoButton } from "../../_components/ExcluirEmpreendimentoButton";

export const metadata = { title: "Quadro de itens — Gestão das Obras" };

export default async function EmpreendimentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let emp: EmpreendimentoComProgresso | null = null;
  let itens: ItemComRefs[] = [];
  let disciplinas: Disciplina[] = [];
  let etapas: Etapa[] = [];
  let projetistas: Projetista[] = [];
  let usuarios: UsuarioBasico[] = [];
  let podeEditar = false;
  let authNeeded = false;

  try {
    const [e, its, discs, etps, projs, usrs, ctx] = await Promise.all([
      getEmpreendimento(id),
      listItensPorEmpreendimento(id),
      listDisciplinas(),
      listEtapas(),
      listProjetistas(),
      listUsuariosBasico(),
      getCurrentUserWithRole(),
    ]);
    emp = e;
    itens = its;
    disciplinas = discs;
    etapas = etps;
    projetistas = projs;
    usuarios = usrs;
    podeEditar = ctx?.papel === "admin" || ctx?.papel === "equipe";
  } catch (err) {
    if (err instanceof AuthError) authNeeded = true;
    else throw err;
  }

  if (authNeeded) {
    return (
      <div>
        <header className="page-head">
          <div className="page-head__crumb">
            <Link href="/empreendimentos">Empreendimentos</Link> / Detalhe
          </div>
          <h1 className="page-head__title">Quadro de itens</h1>
        </header>
        <div className="empty-state">Entre com sua conta para ver os itens do empreendimento.</div>
      </div>
    );
  }

  if (!emp) notFound();

  const hojeISO = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <header className="page-head">
        <div className="detail-head__top">
          <div className="page-head__crumb" style={{ marginBottom: 0 }}>
            <Link href="/empreendimentos">Empreendimentos</Link> / Detalhe
          </div>
          {podeEditar && <ExcluirEmpreendimentoButton id={emp.id} nome={emp.nome} />}
        </div>
        <div className="detail-head" style={{ marginTop: "12px" }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="page-head__title">{emp.nome}</h1>
            <div className="detail-head__meta">
              <Campo rotulo="Itens" valor={String(emp.totalItens)} mono />
            </div>
          </div>
          <div className="detail-head__progress">
            <div className="detail-head__progress-row">
              <span>Progresso</span>
              <span className="mono" style={{ color: "var(--ink)" }}>
                {emp.progresso}%
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${emp.progresso}%` }} />
            </div>
            <div className="detail-head__counts">
              <span>{emp.itensFinalizados} finalizados</span>
              <span>·</span>
              <span>{emp.itensEmAndamento} em andamento</span>
              <span>·</span>
              <span style={{ color: "#9b2c22" }}>{emp.itensAtrasados} atrasados</span>
            </div>
          </div>
        </div>
      </header>

      <ItensBoard
        empreendimentoId={emp.id}
        itens={itens}
        disciplinas={disciplinas}
        etapas={etapas}
        projetistas={projetistas}
        usuarios={usuarios}
        podeEditar={podeEditar}
        hojeISO={hojeISO}
      />
    </div>
  );
}

function Campo({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <div className="detail-head__campo-label">{rotulo}</div>
      <div className={`detail-head__campo-valor${mono ? " mono" : ""}`}>{valor}</div>
    </div>
  );
}
