"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Projetista } from "@/db/schema";
import type { AtrasoProjetista, PainelProjetista } from "@/lib/actions/projetistas";
import {
  deleteProjetista,
  listPainelProjetista,
  updateProjetista,
} from "@/lib/actions/projetistas";
import type { StatusDerivado } from "@/lib/ui/status";
import { derivarStatusProjetista, formatBR, parseISO } from "@/lib/ui/status";
import { formatTelefone } from "@/lib/ui/telefone";
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
                <td className="mono td-muted">{p.telefone ? formatTelefone(p.telefone) : "—"}</td>
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
 * Drawer do projetista — cadastro + desempenho + histórico de atrasos
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
    // Formata na abertura: registros antigos podem estar sem máscara.
    telefone: formatTelefone(projetista.telefone ?? ""),
    email: projetista.email ?? "",
  }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [painel, setPainel] = useState<PainelProjetista | null>(null);

  // Carrega desempenho + atrasos do projetista ao abrir.
  useEffect(() => {
    let vivo = true;
    listPainelProjetista(projetista.id)
      .then((p) => vivo && setPainel(p))
      .catch(() => vivo && setPainel({ itens: [], atrasos: [] }));
    return () => {
      vivo = false;
    };
  }, [projetista.id]);

  const set = (campo: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = campo === "telefone" ? formatTelefone(e.target.value) : e.target.value;
    setDraft((d) => ({ ...d, [campo]: valor }));
  };

  // Resumo agregado + linhas já com o desvio derivado NA ÓTICA DO PROJETISTA:
  // item em análise já conta como entregue (ele mandou o projeto para a equipe).
  const { linhas, atrasos, desvioPorItem, resumo } = useMemo(() => {
    const linhas = (painel?.itens ?? []).map((h) => ({
      ...h,
      d: derivarStatusProjetista(h, hoje),
    }));
    const atrasos = painel?.atrasos ?? [];
    // O desvio de cada ocorrência de atraso é o do item HOJE — indexado por id.
    const desvioPorItem = new Map(linhas.map((l) => [l.id, l.d]));

    const total = linhas.length;
    const entregues = linhas.filter((l) => l.d.rotulo === "Finalizado").length;
    const noPrazo = linhas.filter(
      (l) => l.d.rotulo === "Finalizado" && l.d.desvioTom === "verde",
    ).length;
    const emAtraso = linhas.filter((l) => l.d.atrasado).length;
    const pct = entregues ? Math.round((noPrazo / entregues) * 100) : null;
    // Reincidência: itens que estouraram prazo mais de uma vez (previsto e
    // depois a reprogramação) — o sinal mais forte contra o projetista.
    const reincidentes = new Set(atrasos.filter((a) => a.ordem > 1).map((a) => a.itemId)).size;
    return {
      linhas,
      atrasos,
      desvioPorItem,
      resumo: { total, entregues, noPrazo, emAtraso, pct, reincidentes },
    };
  }, [painel, hoje]);

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
      <aside className="drawer-panel drawer-panel--wide">
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
                inputMode="tel"
                placeholder="(81)99999-0000"
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
              <div className="field__label">Itens finalizados</div>
              <div className="mono">
                {resumo.entregues} de {resumo.total}
              </div>
            </div>
            <div>
              <div className="field__label">Entregas no prazo</div>
              <div className="mono">{resumo.pct === null ? "—" : `${resumo.pct}%`}</div>
            </div>
            <div>
              <div className="field__label">Em atraso hoje</div>
              <div className={`mono${resumo.emAtraso > 0 ? " td-danger" : ""}`}>{resumo.emAtraso}</div>
            </div>
            <div>
              <div className="field__label">Atrasos no histórico</div>
              <div className={`mono${atrasos.length > 0 ? " td-danger" : ""}`}>{atrasos.length}</div>
            </div>
          </div>

          <div className="drawer-history">
            <div className="drawer-section-head">
              <span className="field__label">Histórico de desempenho</span>
              <span className="drawer-section-head__nota">
                O item vai para "Finalizado" aqui assim que entra em análise — nesse
                ponto o projetista já enviou o projeto para a equipe.
              </span>
            </div>
            {painel === null ? (
              <div className="drawer-history__empty">Carregando…</div>
            ) : linhas.length === 0 ? (
              <div className="drawer-history__empty">
                Nenhum item atribuído a este projetista ainda.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table" style={{ minWidth: "740px" }}>
                  <thead>
                    <tr>
                      <th>Empreendimento</th>
                      <th>Disciplina</th>
                      <th>Etapa</th>
                      <th>Status</th>
                      <th>Entrega</th>
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
                        <td className="mono td-muted">{formatBR(l.entregaProjetista)}</td>
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

          <div className="drawer-history">
            <div className="drawer-section-head">
              <span className="field__label">Histórico de atrasos</span>
              <span className="drawer-section-head__nota">
                {resumo.reincidentes > 0
                  ? `${resumo.reincidentes} ${
                      resumo.reincidentes === 1 ? "item reincidente" : "itens reincidentes"
                    } (atrasou o previsto e depois o reprogramado)`
                  : "Uma linha por prazo estourado — previsto e cada reprogramação."}
              </span>
            </div>
            {painel === null ? (
              <div className="drawer-history__empty">Carregando…</div>
            ) : atrasos.length === 0 ? (
              <div className="drawer-history__empty">
                Nenhum atraso registrado para este projetista.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table" style={{ minWidth: "900px" }}>
                  <thead>
                    <tr>
                      <th>Empreendimento</th>
                      <th>Disciplina</th>
                      <th>Etapa</th>
                      <th>Início</th>
                      <th>Data do atraso</th>
                      <th>Realizado</th>
                      <th className="ta-right">Desvio hoje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atrasos.map((a) => (
                      <LinhaAtraso key={a.id} atraso={a} desvio={desvioPorItem.get(a.itemId)} />
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

/**
 * Uma ocorrência de atraso. "Data do atraso" é o prazo que furou — o previsto
 * original ou a reprogramação —, com os dias daquela ocorrência e uma tag
 * dizendo qual dos dois foi, em vermelho quando é reincidência (2º atraso do
 * mesmo item). Já "Realizado" e "Desvio hoje" são do ITEM, não da ocorrência.
 */
function LinhaAtraso({
  atraso: a,
  desvio,
}: {
  atraso: AtrasoProjetista;
  desvio?: StatusDerivado;
}) {
  const rotuloOrigem =
    a.origem === "reprogramado" ? `Reprogramado · ${a.ordem}º atraso` : "Prazo previsto";
  return (
    <tr>
      <td className="td-muted">{a.empreendimentoNome}</td>
      <td className="td-strong">{a.disciplinaNome}</td>
      <td>{a.etapaNome}</td>
      <td className="mono td-muted">{formatBR(a.dataInicio)}</td>
      <td>
        <span className="mono td-danger">{formatBR(a.prazoAtraso)}</span>{" "}
        <span className="mono td-danger">+{a.dias}d</span>{" "}
        <span
          className={`tag-origem${a.ordem > 1 ? " tag-origem--reincidencia" : ""}`}
          title={
            a.reprogramadoPara
              ? `Reprogramado para ${formatBR(a.reprogramadoPara)}`
              : a.emAberto
                ? "Sem entrega e sem reprogramação — o atraso ainda corre"
                : `Entregue pelo projetista em ${formatBR(a.realizado)}`
          }
        >
          {rotuloOrigem}
        </span>
      </td>
      <td className="mono td-muted">{formatBR(a.prazoRealizado)}</td>
      <td className="ta-right">
        {desvio ? <DesvioBadge tom={desvio.desvioTom} texto={desvio.desvio} /> : "—"}
      </td>
    </tr>
  );
}
