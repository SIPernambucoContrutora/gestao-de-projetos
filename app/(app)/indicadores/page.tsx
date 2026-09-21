import { Suspense } from "react";
import { getDadosIndicadores } from "@/lib/actions/analytics";
import type { LinhaIndicador } from "@/lib/actions/analytics";
import type { Etapa, Projetista } from "@/db/schema";
import { listEtapas } from "@/lib/actions/listas";
import { listProjetistas } from "@/lib/actions/projetistas";
import { listUsuariosBasico } from "@/lib/actions/usuarios";
import type { UsuarioBasico } from "@/lib/actions/usuarios";
import { AuthError, getCurrentUserWithRole } from "@/lib/auth/session";
import { hojeISORecife } from "@/lib/ui/status";
import { IndicadoresView } from "../_components/indicadores/IndicadoresView";

export const metadata = { title: "Indicadores — Gestão de Projetos" };

export default async function IndicadoresPage() {
  let itens: LinhaIndicador[] = [];
  let etapas: Etapa[] = [];
  let projetistas: Projetista[] = [];
  let usuarios: UsuarioBasico[] = [];
  let podeEditar = false;
  let hojeISO = hojeISORecife();
  let authNeeded = false;

  try {
    // etapas/projetistas/usuários só alimentam o drawer de edição do item
    // (aberto a partir do painel de "itens filtrados") — o mesmo drawer que
    // /empreendimentos/[id] usa, então precisa das mesmas listas.
    const [dados, etps, projs, usrs, ctx] = await Promise.all([
      getDadosIndicadores(),
      listEtapas(),
      listProjetistas(),
      listUsuariosBasico(),
      getCurrentUserWithRole(),
    ]);
    itens = dados.itens;
    hojeISO = dados.hojeISO;
    etapas = etps;
    projetistas = projs;
    usuarios = usrs;
    podeEditar = ctx?.papel === "admin" || ctx?.papel === "equipe";
  } catch (e) {
    if (e instanceof AuthError) authNeeded = true;
    else throw e;
  }

  if (authNeeded) {
    return (
      <div>
        <header className="page-head">
          <h1 className="page-head__title">Indicadores</h1>
          <p className="page-head__sub">
            Prazo, vazão e retrabalho por disciplina, projetista e empreendimento
          </p>
        </header>
        <div className="empty-state">Entre com sua conta para ver os indicadores.</div>
      </div>
    );
  }

  // useSearchParams (o estado dos filtros na URL) exige uma fronteira de
  // Suspense no App Router — sem ela a rota inteira cai para render dinâmico.
  return (
    <Suspense fallback={<div className="empty-state">Carregando indicadores…</div>}>
      <IndicadoresView
        itens={itens}
        hojeISO={hojeISO}
        etapas={etapas}
        projetistas={projetistas}
        usuarios={usuarios}
        podeEditar={podeEditar}
      />
    </Suspense>
  );
}
