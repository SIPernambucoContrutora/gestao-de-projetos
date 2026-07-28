import Link from "next/link";
import { listHistoricoGlobal } from "@/lib/actions/historico";
import type { HistoricoGlobal } from "@/lib/actions/historico";
import { AuthError } from "@/lib/auth/session";
import { formatDataHora, rotuloCampo } from "@/lib/ui/status";

export const metadata = { title: "Histórico — Gestão das Obras" };

const TAG = {
  criacao: { label: "Criação", cls: "hist-tag--criacao" },
  edicao: { label: "Edição", cls: "hist-tag--edicao" },
  exclusao: { label: "Exclusão", cls: "hist-tag--exclusao" },
} as const;

function numero(n: number | null) {
  return n != null ? String(n).padStart(2, "0") : null;
}

export default async function HistoricoPage() {
  let itens: HistoricoGlobal[] = [];
  let authNeeded = false;
  try {
    itens = await listHistoricoGlobal();
  } catch (e) {
    if (e instanceof AuthError) authNeeded = true;
    else throw e;
  }

  return (
    <div>
      <header className="page-head">
        <h1 className="page-head__title">Histórico de alterações</h1>
        <p className="page-head__sub">Auditoria de criações, edições e exclusões nos projetos</p>
      </header>

      {authNeeded ? (
        <div className="empty-state">Entre com sua conta para ver o histórico.</div>
      ) : itens.length === 0 ? (
        <div className="empty-state">Nenhuma alteração registrada ainda.</div>
      ) : (
        <section style={{ padding: "22px 28px 48px", maxWidth: "900px" }}>
          {itens.map((h) => (
            <LinhaHistorico key={h.id} h={h} />
          ))}
        </section>
      )}
    </div>
  );
}

function LinhaHistorico({ h }: { h: HistoricoGlobal }) {
  const autor = h.autorNome || h.autorEmail || "Usuário";
  const tag = TAG[h.acao];
  const num = numero(h.itemNumero);
  const ehItem = h.itemId != null;

  let titulo: React.ReactNode;
  if (h.acao === "criacao") {
    titulo = ehItem ? (
      <>
        criou o <strong>item {num ?? "—"}</strong>
      </>
    ) : (
      <>
        criou o empreendimento <strong>{h.valorNovo ?? h.empreendimentoNome ?? ""}</strong>
      </>
    );
  } else if (h.acao === "exclusao") {
    titulo =
      h.campo === "empreendimento" ? (
        <>
          excluiu o empreendimento <strong>{h.valorAntigo ?? h.empreendimentoNome ?? ""}</strong>
        </>
      ) : (
        <>
          excluiu <strong>{h.valorAntigo ?? "um item"}</strong>
        </>
      );
  } else {
    titulo = (
      <>
        alterou <strong>{rotuloCampo(h.campo)}</strong>
      </>
    );
  }

  return (
    <div className="hist-row">
      <div className="hist-row__marker">
        <span className="hist-row__dot" />
        <span className="hist-row__line" />
      </div>
      <div style={{ flex: 1 }}>
        <div className="hist-global__head">
          <div className="hist-global__title">
            <span className={`hist-tag ${tag.cls}`}>{tag.label}</span>{" "}
            <strong>{autor}</strong> {titulo}
          </div>
          <div className="hist-global__time mono">{formatDataHora(h.createdAt)}</div>
        </div>

        {h.acao === "edicao" && (
          <div className="hist-row__change">
            <span className="hist-row__old">{h.valorAntigo ?? "—"}</span> →{" "}
            <span className="hist-row__new">{h.valorNovo ?? "—"}</span>
          </div>
        )}

        <div className="hist-global__ctx">
          {h.empreendimentoId && h.empreendimentoNome ? (
            <Link href={`/empreendimentos/${h.empreendimentoId}`}>{h.empreendimentoNome}</Link>
          ) : (
            (h.empreendimentoNome ?? "—")
          )}
          {num && ` · item ${num}`}
          {h.disciplinaNome && ` · ${h.disciplinaNome}`}
        </div>
      </div>
    </div>
  );
}
