import Link from "next/link";
import { notFound } from "next/navigation";
import { getEmpreendimento } from "@/lib/actions/empreendimentos";
import { listItensPorEmpreendimento } from "@/lib/actions/itens";
import type { ItemComRefs } from "@/lib/actions/itens";
import { listEtapas } from "@/lib/actions/listas";
import { listProjetistas } from "@/lib/actions/projetistas";
import { listUsuariosBasico } from "@/lib/actions/usuarios";
import type { UsuarioBasico } from "@/lib/actions/usuarios";
import type { Etapa, Projetista } from "@/db/schema";
import type { EmpreendimentoComProgresso } from "@/lib/actions/empreendimentos";
import { AuthError, getCurrentUserWithRole } from "@/lib/auth/session";
import { hojeISORecife } from "@/lib/ui/status";
import { CicloDeVidaGantt } from "../../../_components/CicloDeVidaGantt";

export const metadata = { title: "Ciclo de vida — Gestão de Projetos" };

export default async function CicloDeVidaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let emp: EmpreendimentoComProgresso | null = null;
  let itens: ItemComRefs[] = [];
  let etapas: Etapa[] = [];
  let projetistas: Projetista[] = [];
  let usuarios: UsuarioBasico[] = [];
  let podeEditar = false;
  let authNeeded = false;

  try {
    const [e, its, etps, projs, usrs, ctx] = await Promise.all([
      getEmpreendimento(id),
      listItensPorEmpreendimento(id),
      listEtapas(),
      listProjetistas(),
      listUsuariosBasico(),
      getCurrentUserWithRole(),
    ]);
    emp = e;
    itens = its;
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
            <Link href="/empreendimentos">Empreendimentos</Link> / Ciclo de vida
          </div>
          <h1 className="page-head__title">Ciclo de vida</h1>
        </header>
        <div className="empty-state">Entre com sua conta para ver o ciclo de vida do empreendimento.</div>
      </div>
    );
  }

  if (!emp) notFound();

  const hojeISO = hojeISORecife();

  return (
    <div>
      <header className="page-head">
        <div className="page-head__crumb">
          <Link href={`/empreendimentos/${emp.id}`}>{emp.nome}</Link> / Ciclo de vida
        </div>
        <h1 className="page-head__title">Ciclo de vida — {emp.nome}</h1>
      </header>

      <div className="ind-body">
        <CicloDeVidaGantt
          itens={itens}
          hojeISO={hojeISO}
          nomeEmpreendimento={emp.nome}
          etapas={etapas}
          projetistas={projetistas}
          usuarios={usuarios}
          podeEditar={podeEditar}
        />
      </div>
    </div>
  );
}
