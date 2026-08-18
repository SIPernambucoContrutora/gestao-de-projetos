"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Projetista } from "@/db/schema";
import type { DesempenhoProjetista } from "@/lib/actions/projetistas";
import {
  deleteProjetista,
  listDesempenhoProjetista,
  updateProjetista,
} from "@/lib/actions/projetistas";
import { derivarStatus, formatBR, parseISO } from "@/lib/ui/status";
import { DesvioBadge, StatusBadge } from "./StatusBadge";

export function ProjetistasTable({
  projetistas,
  podeEditar,
  hojeISO,
}: {
  projetistas: Projetista[];
  podeEditar: boolean;
  hojeISO: string;
}) {
  const [aberto, setAberto] = useState<Projetista | null>(null);
  const hoje = useMemo(() => parseISO(hojeISO) ?? new Date(), [hojeISO]);

  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>E-mail</th>
            </tr>
          </thead>
          <tbody>
            {projetistas.map((p) => (
              <tr key={p.id} className="row-item" onClick={() => setAberto(p)}>
                <td className="td-strong">{p.nome}</td>
                <td className="mono td-muted">{p.telefone ?? "—"}</td>
                <td className="td-muted">{p.email ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aberto && (
        <ProjetistaDrawer
          key={aberto.id}
          projetista={aberto}
          podeEditar={podeEditar}
          hoje={hoje}
          onClose={() => setAberto(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Drawer do projetista — cadastro + histórico de desempenho
 * ------------------------------------------------------------------ */

type Draft = { nome: string; telefone: string; email: string };

function ProjetistaDrawer({
  projetista,
  podeEditar,
  hoje,
  onClose,
}: {
  projetista: Projetista;
  podeEditar: boolean;
  hoje: Date;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => ({
    nome: projetista.nome,
    telefone: projetista.telefone ?? "",
    email: projetista.email ?? "",
  }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [historico, setHistorico] = useState<DesempenhoProjetista[] | null>(null);

  // Carrega o desempenho do projetista ao abrir.
  useEffect(() => {
    let vivo = true;
    listDesempenhoProjetista(projetista.id)
      .then((h) => vivo && setHistorico(h))
      .catch(() => vivo && setHistorico([]));
    return () => {
      vivo = false;
    };
  }, [projetista.id]);

  const set = (campo: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [campo]: e.target.value }));

  // Resumo agregado + linhas já com o desvio derivado.
  const { linhas, resumo } = useMemo(() => {
    const linhas = (historico ?? []).map((h) => ({ ...h, d: derivarStatus(h, hoje) }));
    const total = linhas.length;
    const concluidos = linhas.filter((l) => l.prazoRealizado).length;
    const noPrazo = linhas.filter((l) => l.prazoRealizado && l.d.desvioTom === "verde").length;
    const emAtraso = linhas.filter((l) => !l.prazoRealizado && l.d.atrasado).length;
    const pct = concluidos ? Math.round((noPrazo / concluidos) * 100) : null;
    return { linhas, resumo: { total, concluidos, noPrazo, emAtraso, pct } };
  }, [historico, hoje]);

  async function salvar() {
    if (!draft.nome.trim()) return setErro("Informe o nome do projetista.");
    setSalvando(true);
    setErro(null);
    try {
      await updateProjetista(projetista.id, {
        nome: draft.nome,
        telefone: draft.telefone || null,
        email: draft.email || null,
      });
      router.refresh();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!window.confirm(`Excluir o projetista "${projetista.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await deleteProjetista(projetista.id);
      router.refresh();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir.");
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer-panel">
        <div className="drawer-head">
          <div>
            <div className="drawer-head__eyebrow mono">PROJETISTA</div>
            <h2 className="drawer-head__title">{projetista.nome}</h2>
            <div className="drawer-head__sub">
              {resumo.total === 0
                ? "Sem itens atribuídos"
                : `${resumo.total} ${resumo.total === 1 ? "item atribuído" : "itens atribuídos"}`}
            </div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="drawer-body">
          {!podeEditar && (
            <div className="drawer-note">
              Seu papel é <strong>leitura</strong> — os campos abaixo estão apenas para consulta.
            </div>
          )}

          <label className="field">
            <span className="field__label">Nome do projetista *</span>
            <input className="input" value={draft.nome} onChange={set("nome")} disabled={!podeEditar} />
          </label>

          <div className="form-grid" style={{ marginTop: "12px" }}>
            <label className="field">
              <span className="field__label">Telefone</span>
              <input
                className="input mono"
                value={draft.telefone}
                onChange={set("telefone")}
                disabled={!podeEditar}
              />
            </label>
            <label className="field">
              <span className="field__label">E-mail</span>
              <input
                type="email"
                className="input"
                value={draft.email}
                onChange={set("email")}
                disabled={!podeEditar}
              />
            </label>
          </div>

          <div className="drawer-derived">
            <div>
              <div className="field__label">Itens concluídos</div>
              <div className="mono">{resumo.concluidos} de {resumo.total}</div>
            </div>
            <div>
              <div className="field__label">Entregas no prazo</div>
              <div className="mono">{resumo.pct === null ? "—" : `${resumo.pct}%`}</div>
            </div>
            <div>
              <div className="field__label">Em atraso hoje</div>
              <div className={`mono${resumo.emAtraso > 0 ? " td-danger" : ""}`}>{resumo.emAtraso}</div>
            </div>
          </div>

          <div className="drawer-history">
            <div className="field__label" style={{ marginBottom: "10px" }}>
              Histórico de desempenho
            </div>
            {historico === null ? (
              <div className="drawer-history__empty">Carregando…</div>
            ) : linhas.length === 0 ? (
              <div className="drawer-history__empty">
                Nenhum item atribuído a este projetista ainda.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table" style={{ minWidth: "620px" }}>
                  <thead>
                    <tr>
                      <th>Empreendimento</th>
                      <th>Disciplina</th>
                      <th>Etapa</th>
                      <th>Status</th>
                      <th>Realizado</th>
                      <th className="ta-right">Desvio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr key={l.id}>
                        <td className="td-muted">{l.empreendimentoNome}</td>
                        <td className="td-strong">{l.disciplinaNome}</td>
                        <td>{l.etapaNome}</td>
                        <td>
                          <StatusBadge tom={l.d.tom} rotulo={l.d.rotulo} />
                        </td>
                        <td className="mono td-muted">{formatBR(l.prazoRealizado)}</td>
                        <td className="ta-right">
                          <DesvioBadge tom={l.d.desvioTom} texto={l.d.desvio} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {podeEditar && (
          <div className="drawer-foot">
            <button type="button" className="btn-danger" onClick={excluir} disabled={salvando}>
              Excluir
            </button>
            <div className="drawer-foot__right">
              {erro && <span className="drawer-foot__erro drawer-foot__erro--inline">{erro}</span>}
              <button type="button" className="btn-soft" onClick={onClose} disabled={salvando}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
