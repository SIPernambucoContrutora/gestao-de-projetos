"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Disciplina, Etapa, HistoricoAlteracao, Projetista, StatusItem } from "@/db/schema";
import type { ItemComRefs } from "@/lib/actions/itens";
import { deleteItem, updateItem } from "@/lib/actions/itens";
import { listHistoricoPorItem } from "@/lib/actions/historico";
import { derivarStatus, formatBR, parseISO, rotuloCampo, ROTULO_STATUS } from "@/lib/ui/status";
import { DesvioBadge, StatusBadge } from "./StatusBadge";
import { NovoItemButton } from "./NovoItemButton";

type ChipKey = "all" | StatusItem | "atrasado";

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "finalizado", label: "Finalizados" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "atrasado", label: "Atrasados" },
  { key: "pendente", label: "Pendentes" },
];

export function ItensBoard({
  empreendimentoId,
  itens,
  disciplinas,
  etapas,
  projetistas,
  podeEditar,
  hojeISO,
}: {
  empreendimentoId: string;
  itens: ItemComRefs[];
  disciplinas: Disciplina[];
  etapas: Etapa[];
  projetistas: Projetista[];
  podeEditar: boolean;
  hojeISO: string;
}) {
  const hoje = useMemo(() => parseISO(hojeISO) ?? new Date(), [hojeISO]);

  const [fDisc, setFDisc] = useState("all");
  const [fStatus, setFStatus] = useState<ChipKey>("all");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<ItemComRefs | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((it) => {
      if (fDisc !== "all" && it.disciplinaId !== fDisc) return false;
      if (q) {
        const hay = `${it.planta ?? ""} ${it.disciplinaNome} ${it.etapaNome}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fStatus !== "all") {
        const d = derivarStatus(it, hoje);
        if (fStatus === "atrasado") return d.atrasado;
        return it.status === fStatus && !d.atrasado;
      }
      return true;
    });
  }, [itens, fDisc, fStatus, busca, hoje]);

  function exportarCSV() {
    const sep = ";";
    const dt = (s: string | null) => (s ? formatBR(s) : "");
    const head = [
      "Nº", "Disciplina", "Etapa", "Planta/escopo", "Status",
      "Início", "Previsto", "Reprogramado", "Realizado", "Meta", "Desvio",
    ];
    const linhas = filtrados.map((it) => {
      const d = derivarStatus(it, hoje);
      return [
        it.item != null ? String(it.item).padStart(2, "0") : "",
        it.disciplinaNome, it.etapaNome, it.planta ?? "", d.rotulo,
        dt(it.dataInicio), dt(it.prazoPrevisto), dt(it.prazoReprogramado), dt(it.prazoRealizado),
        it.metaDias ?? "", d.desvio,
      ];
    });
    const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [head, ...linhas].map((r) => r.map(esc).join(sep)).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `itens-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="board">
      <div className="board-toolbar">
        <input
          className="input"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar item…"
          style={{ width: "240px" }}
        />
        <select className="input" value={fDisc} onChange={(e) => setFDisc(e.target.value)}>
          <option value="all">Todas as disciplinas</option>
          {disciplinas.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </select>
        <div className="chips">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip${fStatus === c.key ? " chip--on" : ""}`}
              onClick={() => setFStatus(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="board-toolbar__spacer" />
        <span className="mono board-toolbar__count">{filtrados.length} itens</span>
        <button type="button" className="btn-soft" onClick={exportarCSV} disabled={filtrados.length === 0}>
          Exportar
        </button>
        {podeEditar && (
          <NovoItemButton
            empreendimentoId={empreendimentoId}
            disciplinas={disciplinas}
            etapas={etapas}
            projetistas={projetistas}
          />
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table" style={{ minWidth: "1360px" }}>
          <thead>
            <tr>
              <th style={{ width: "44px" }}>#</th>
              <th>Disciplina</th>
              <th>Etapa</th>
              <th>Projetista</th>
              <th>Planta / escopo</th>
              <th>Status</th>
              <th>Início</th>
              <th>Previsto</th>
              <th>Reprog.</th>
              <th>Realizado</th>
              <th>Meta</th>
              <th className="ta-right">Desvio</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={12} className="data-table__empty">
                  Nenhum item corresponde aos filtros.
                </td>
              </tr>
            ) : (
              filtrados.map((it) => {
                const d = derivarStatus(it, hoje);
                return (
                  <tr
                    key={it.id}
                    className={`row-item${d.atrasado ? " row-item--atrasado" : ""}`}
                    onClick={() => setAberto(it)}
                  >
                    <td className="mono td-muted">
                      {it.item != null ? String(it.item).padStart(2, "0") : "—"}
                    </td>
                    <td className="td-strong">{it.disciplinaNome}</td>
                    <td>{it.etapaNome}</td>
                    <td className="td-muted">{it.projetistaNome ?? "—"}</td>
                    <td className="td-wide">{it.planta ?? "—"}</td>
                    <td>
                      <StatusBadge tom={d.tom} rotulo={d.rotulo} />
                    </td>
                    <td className="mono td-muted">{formatBR(it.dataInicio)}</td>
                    <td className="mono td-muted">{formatBR(it.prazoPrevisto)}</td>
                    <td className="mono td-muted">{formatBR(it.prazoReprogramado)}</td>
                    <td className="mono td-muted">{formatBR(it.prazoRealizado)}</td>
                    <td className="mono td-muted">{it.metaDias ?? "—"}</td>
                    <td className="ta-right">
                      <DesvioBadge tom={d.desvioTom} texto={d.desvio} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {aberto && (
        <ItemDrawer
          key={aberto.id}
          item={aberto}
          etapas={etapas}
          projetistas={projetistas}
          podeEditar={podeEditar}
          hoje={hoje}
          onClose={() => setAberto(null)}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Drawer de edição
 * ------------------------------------------------------------------ */

type Draft = {
  status: StatusItem;
  etapaId: string;
  projetistaId: string;
  dataInicio: string;
  prazoPrevisto: string;
  prazoReprogramado: string;
  prazoRealizado: string;
  observacoes: string;
  revisaoAtual: string;
  dataRevisao: string;
};

function toDraft(it: ItemComRefs): Draft {
  return {
    status: it.status,
    etapaId: it.etapaId,
    projetistaId: it.projetistaId ?? "",
    dataInicio: it.dataInicio ?? "",
    prazoPrevisto: it.prazoPrevisto ?? "",
    prazoReprogramado: it.prazoReprogramado ?? "",
    prazoRealizado: it.prazoRealizado ?? "",
    observacoes: it.observacoes ?? "",
    revisaoAtual: it.revisaoAtual ?? "R00",
    dataRevisao: it.dataRevisao ?? "",
  };
}

function ItemDrawer({
  item,
  etapas,
  projetistas,
  podeEditar,
  hoje,
  onClose,
}: {
  item: ItemComRefs;
  etapas: Etapa[];
  projetistas: Projetista[];
  podeEditar: boolean;
  hoje: Date;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(item));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoAlteracao[] | null>(null);

  // Carrega o histórico do item ao abrir.
  useEffect(() => {
    let vivo = true;
    listHistoricoPorItem(item.id)
      .then((h) => vivo && setHistorico(h))
      .catch(() => vivo && setHistorico([]));
    return () => {
      vivo = false;
    };
  }, [item.id]);

  const set = (campo: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [campo]: e.target.value }));

  const derivado = derivarStatus(
    {
      status: draft.status,
      prazoPrevisto: draft.prazoPrevisto || null,
      prazoReprogramado: draft.prazoReprogramado || null,
      prazoRealizado: draft.prazoRealizado || null,
    },
    hoje,
  );

  async function excluir() {
    const rotulo = item.item != null ? `item ${String(item.item).padStart(2, "0")}` : "este item";
    if (!window.confirm(`Excluir ${rotulo} (${item.disciplinaNome})? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await deleteItem(item.id);
      router.refresh();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir.");
      setSalvando(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await updateItem(item.id, {
        status: draft.status,
        etapaId: draft.etapaId,
        projetistaId: draft.projetistaId || null,
        dataInicio: draft.dataInicio || null,
        prazoPrevisto: draft.prazoPrevisto || null,
        prazoReprogramado: draft.prazoReprogramado || null,
        prazoRealizado: draft.prazoRealizado || null,
        observacoes: draft.observacoes || null,
        revisaoAtual: draft.revisaoAtual || "R00",
        dataRevisao: draft.dataRevisao || null,
      });
      router.refresh();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer-panel">
        <div className="drawer-head">
          <div>
            <div className="drawer-head__eyebrow mono">
              ITEM {item.item != null ? String(item.item).padStart(2, "0") : "—"} · {item.disciplinaNome}
            </div>
            <h2 className="drawer-head__title">{item.disciplinaNome}</h2>
            <div className="drawer-head__sub">{item.planta ?? "—"}</div>
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

          <div className="form-grid">
            <label className="field">
              <span className="field__label">Status</span>
              <select
                className="input"
                value={draft.status}
                onChange={set("status")}
                disabled={!podeEditar}
              >
                {(Object.keys(ROTULO_STATUS) as StatusItem[]).map((s) => (
                  <option key={s} value={s}>
                    {ROTULO_STATUS[s]}
                  </option>
                ))}
              </select>
              <span className="field__hint">A cor do badge é derivada do status + prazos.</span>
            </label>

            <label className="field">
              <span className="field__label">Etapa</span>
              <select
                className="input"
                value={draft.etapaId}
                onChange={set("etapaId")}
                disabled={!podeEditar}
              >
                {etapas.map((et) => (
                  <option key={et.id} value={et.id}>
                    {et.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Projetista</span>
              <select
                className="input"
                value={draft.projetistaId}
                onChange={set("projetistaId")}
                disabled={!podeEditar}
              >
                <option value="">Sem projetista</option>
                {projetistas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>

            <DateField label="Data de início" value={draft.dataInicio} onChange={set("dataInicio")} disabled={!podeEditar} />
            <DateField label="Prazo previsto" value={draft.prazoPrevisto} onChange={set("prazoPrevisto")} disabled={!podeEditar} />
            <DateField label="Prazo reprogramado" value={draft.prazoReprogramado} onChange={set("prazoReprogramado")} disabled={!podeEditar} />
            <DateField label="Prazo realizado" value={draft.prazoRealizado} onChange={set("prazoRealizado")} disabled={!podeEditar} />

            <label className="field">
              <span className="field__label">Revisão atual</span>
              <input
                className="input mono"
                value={draft.revisaoAtual}
                onChange={set("revisaoAtual")}
                disabled={!podeEditar}
              />
            </label>
            <DateField label="Data da revisão" value={draft.dataRevisao} onChange={set("dataRevisao")} disabled={!podeEditar} />
          </div>

          <label className="field" style={{ marginTop: "14px" }}>
            <span className="field__label">Observações</span>
            <textarea
              className="input"
              rows={3}
              value={draft.observacoes}
              onChange={set("observacoes")}
              disabled={!podeEditar}
              style={{ resize: "vertical" }}
            />
          </label>

          <div className="drawer-derived">
            <div>
              <div className="field__label">Meta</div>
              <div className="mono">{item.metaDias ?? "—"}</div>
            </div>
            <div>
              <div className="field__label">Desvio</div>
              <div style={{ marginTop: "3px" }}>
                <DesvioBadge tom={derivado.desvioTom} texto={derivado.desvio} />
              </div>
            </div>
            <div>
              <div className="field__label">Situação</div>
              <div style={{ marginTop: "3px" }}>
                <StatusBadge tom={derivado.tom} rotulo={derivado.rotulo} />
              </div>
            </div>
          </div>

          <div className="drawer-history">
            <div className="field__label" style={{ marginBottom: "10px" }}>
              Histórico do item
            </div>
            {historico === null ? (
              <div className="drawer-history__empty">Carregando…</div>
            ) : historico.length === 0 ? (
              <div className="drawer-history__empty">Sem alterações registradas.</div>
            ) : (
              historico.map((h) => (
                <div key={h.id} className="hist-row">
                  <div className="hist-row__marker">
                    <span className="hist-row__dot" />
                    <span className="hist-row__line" />
                  </div>
                  <div>
                    <div className="hist-row__title">
                      {h.acao === "criacao" ? "Item criado" : rotuloCampo(h.campo)}
                    </div>
                    {h.acao === "edicao" && (
                      <div className="hist-row__change">
                        <span className="hist-row__old">{h.valorAntigo ?? "—"}</span> →{" "}
                        <span className="hist-row__new">{h.valorNovo ?? "—"}</span>
                      </div>
                    )}
                    <div className="hist-row__meta mono">
                      {new Date(h.createdAt).toLocaleString("pt-BR")}
                    </div>
                  </div>
                </div>
              ))
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

function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input type="date" className="input mono" value={value} onChange={onChange} disabled={disabled} />
    </label>
  );
}
