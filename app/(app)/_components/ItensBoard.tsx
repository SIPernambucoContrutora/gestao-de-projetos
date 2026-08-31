"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Disciplina,
  Etapa,
  HistoricoAlteracao,
  PrioridadeItem,
  Projetista,
  RevisaoItem,
  StatusItem,
} from "@/db/schema";
import type { ItemComRefs } from "@/lib/actions/itens";
import { deleteItem, updateItem } from "@/lib/actions/itens";
import { listHistoricoPorItem } from "@/lib/actions/historico";
import { abrirRevisao, listRevisoesPorItem } from "@/lib/actions/revisoes";
import type { UsuarioBasico } from "@/lib/actions/usuarios";
import {
  derivarStatus,
  formatBR,
  parseISO,
  PRIORIDADES,
  rotuloCampo,
  rotuloRevisao,
  ROTULO_PRIORIDADE,
  resolverStatus,
  ROTULO_STATUS,
  STATUS_SELECIONAVEIS,
} from "@/lib/ui/status";
import { AutodocBadge, DesvioBadge, PrioridadeBadge, StatusBadge } from "./StatusBadge";
import { NovoItemButton } from "./NovoItemButton";

type ChipKey = "all" | StatusItem | "atrasado";

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "finalizado", label: "Finalizados" },
  { key: "em_analise", label: "Em análise" },
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
  usuarios,
  podeEditar,
  hojeISO,
}: {
  empreendimentoId: string;
  itens: ItemComRefs[];
  disciplinas: Disciplina[];
  etapas: Etapa[];
  projetistas: Projetista[];
  usuarios: UsuarioBasico[];
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
      "Nº", "Disciplina", "Etapa", "Planta/escopo", "Status", "Prioridade",
      "Início", "Previsto", "Reprogramado", "Realizado", "Desvio",
    ];
    const linhas = filtrados.map((it) => {
      const d = derivarStatus(it, hoje);
      return [
        it.item != null ? String(it.item).padStart(2, "0") : "",
        it.disciplinaNome, it.etapaNome, it.planta ?? "", d.rotulo,
        ROTULO_PRIORIDADE[it.prioridade],
        dt(it.dataInicio), dt(it.prazoPrevisto), dt(it.prazoReprogramado), dt(it.prazoRealizado),
        d.desvio,
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
        <table className="data-table" style={{ minWidth: "1460px" }}>
          <thead>
            <tr>
              <th>Disciplina</th>
              <th>Etapa</th>
              <th>Projetista</th>
              <th>Planta / escopo</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th>Início</th>
              <th>Previsto</th>
              <th>Reprog.</th>
              <th>Realizado</th>
              <th className="ta-right">Desvio</th>
              <th>Autodoc</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={13} className="data-table__empty">
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
                    <td className="td-strong">{it.disciplinaNome}</td>
                    <td>{it.etapaNome}</td>
                    <td className="td-muted">{it.projetistaNome ?? "—"}</td>
                    <td className="td-wide">{it.planta ?? "—"}</td>
                    <td>
                      <StatusBadge tom={d.tom} rotulo={d.rotulo} />
                    </td>
                    <td>
                      <PrioridadeBadge prioridade={it.prioridade} />
                    </td>
                    <td className="mono td-muted">{formatBR(it.dataInicio)}</td>
                    <td className="mono td-muted">{formatBR(it.prazoPrevisto)}</td>
                    <td className="mono td-muted">{formatBR(it.prazoReprogramado)}</td>
                    <td className="mono td-muted">{formatBR(it.prazoRealizado)}</td>
                    <td className="ta-right">
                      <DesvioBadge tom={d.desvioTom} texto={d.desvio} />
                    </td>
                    <td>
                      <AutodocBadge enviado={it.enviadoAutodoc} />
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
          usuarios={usuarios}
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
  prioridade: PrioridadeItem;
  usuarioAnaliseId: string;
  etapaId: string;
  projetistaId: string;
  dataInicio: string;
  prazoPrevisto: string;
  prazoReprogramado: string;
  prazoRealizado: string;
  observacoes: string;
  enviadoAutodoc: boolean;
};

function toDraft(it: ItemComRefs): Draft {
  return {
    status: it.status,
    prioridade: it.prioridade,
    usuarioAnaliseId: it.usuarioAnaliseId ?? "",
    etapaId: it.etapaId,
    projetistaId: it.projetistaId ?? "",
    dataInicio: it.dataInicio ?? "",
    prazoPrevisto: it.prazoPrevisto ?? "",
    prazoReprogramado: it.prazoReprogramado ?? "",
    prazoRealizado: it.prazoRealizado ?? "",
    observacoes: it.observacoes ?? "",
    enviadoAutodoc: it.enviadoAutodoc,
  };
}

function ItemDrawer({
  item,
  etapas,
  projetistas,
  usuarios,
  podeEditar,
  hoje,
  onClose,
}: {
  item: ItemComRefs;
  etapas: Etapa[];
  projetistas: Projetista[];
  usuarios: UsuarioBasico[];
  podeEditar: boolean;
  hoje: Date;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(item));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoAlteracao[] | null>(null);
  const [revisoes, setRevisoes] = useState<RevisaoItem[] | null>(null);
  const [modalRevisao, setModalRevisao] = useState(false);

  // Carrega histórico e revisões do item ao abrir.
  useEffect(() => {
    let vivo = true;
    listHistoricoPorItem(item.id)
      .then((h) => vivo && setHistorico(h))
      .catch(() => vivo && setHistorico([]));
    listRevisoesPorItem(item.id)
      .then((r) => vivo && setRevisoes(r))
      .catch(() => vivo && setRevisoes([]));
    return () => {
      vivo = false;
    };
  }, [item.id]);

  const set = (campo: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [campo]: e.target.value }));

  const setChecked = (campo: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [campo]: e.target.checked }));

  const emAnalise = draft.status === "em_analise";
  // Revisar só faz sentido com o item JÁ SALVO como finalizado — escolher
  // 'Finalizado' no seletor sem salvar não acende o botão. E não se abre
  // uma segunda revisão por cima de uma que ainda está em curso.
  const podeRevisar = item.status === "finalizado" && !item.emRevisao;
  // Projetista SALVO no item: é ele quem recebe a solicitação (uma troca de
  // projetista ainda não salva no rascunho não vale aqui).
  const projetistaDoItem = projetistas.find((p) => p.id === item.projetistaId) ?? null;

  // O status é derivado das datas; a ÚNICA escolha manual é 'Em análise', e
  // só a partir de 'Em andamento' (ou seja: com previsto e sem realizado).
  // Nos outros casos o valor vigente aparece como opção desabilitada, e o
  // hint diz que data mexer para sair dali.
  const semPrevisto = !draft.prazoPrevisto;
  const pendente = draft.status === "pendente";
  const finalizado = draft.status === "finalizado";
  const statusTravado = pendente || finalizado;
  const opcoesStatus = statusTravado ? [] : STATUS_SELECIONAVEIS;

  // Mexer no prazo previsto reavalia o status na hora, nos dois sentidos:
  // preencher tira de pendente, limpar devolve para pendente.
  function setPrazoPrevisto(e: React.ChangeEvent<HTMLInputElement>) {
    const prazoPrevisto = e.target.value;
    setDraft((d) => ({
      ...d,
      prazoPrevisto,
      status: resolverStatus(d.status, prazoPrevisto, d.prazoRealizado || null),
    }));
  }

  // Idem para o prazo realizado: preencher finaliza o item na hora (mesmo
  // vindo de 'Em análise'), limpar devolve ao par pendente/em andamento.
  function setPrazoRealizado(e: React.ChangeEvent<HTMLInputElement>) {
    const prazoRealizado = e.target.value;
    setDraft((d) => ({
      ...d,
      prazoRealizado,
      status: resolverStatus(d.status, d.prazoPrevisto || null, prazoRealizado || null),
    }));
  }

  const derivado = derivarStatus(
    {
      status: draft.status,
      prazoPrevisto: draft.prazoPrevisto || null,
      prazoReprogramado: draft.prazoReprogramado || null,
      prazoRealizado: draft.prazoRealizado || null,
      usuarioAnaliseNome: usuarios.find((u) => u.id === draft.usuarioAnaliseId)?.nome ?? null,
      enviadoAutodoc: draft.enviadoAutodoc,
      emRevisao: item.emRevisao,
      // Espelha o que updateItem vai gravar: sair de 'Em análise' para 'Em
      // andamento' marca os ajustes; voltar para a análise limpa a marca.
      ajustesPosAnalise:
        draft.status === "em_analise"
          ? false
          : item.status === "em_analise" && draft.status === "em_andamento"
            ? true
            : item.ajustesPosAnalise,
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
    // 'Em análise' sem responsável é inconsistente — barra antes do round-trip
    // (a Server Action valida de novo, por segurança).
    if (emAnalise && !draft.usuarioAnaliseId) {
      setErro("Selecione o usuário da análise para salvar o status Em análise.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await updateItem(item.id, {
        status: draft.status,
        prioridade: draft.prioridade,
        usuarioAnaliseId: emAnalise ? draft.usuarioAnaliseId : null,
        etapaId: draft.etapaId,
        projetistaId: draft.projetistaId || null,
        dataInicio: draft.dataInicio || null,
        prazoPrevisto: draft.prazoPrevisto || null,
        prazoReprogramado: draft.prazoReprogramado || null,
        prazoRealizado: draft.prazoRealizado || null,
        observacoes: draft.observacoes || null,
        enviadoAutodoc: draft.enviadoAutodoc,
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
                disabled={!podeEditar || statusTravado}
              >
                {pendente && (
                  <option value="pendente" disabled>
                    {ROTULO_STATUS.pendente}
                  </option>
                )}
                {finalizado && (
                  <option value="finalizado" disabled>
                    {ROTULO_STATUS.finalizado}
                  </option>
                )}
                {opcoesStatus.map((s) => (
                  <option key={s} value={s}>
                    {ROTULO_STATUS[s]}
                  </option>
                ))}
              </select>
              <span className="field__hint">
                {finalizado
                  ? "Finalizado pelo prazo realizado. Limpe a data do realizado para reabrir o item."
                  : semPrevisto
                    ? "Sem prazo previsto o item fica Pendente. Informe o previsto para ele entrar em andamento."
                    : "Em análise é a única escolha manual — o resto do status vem das datas."}
              </span>
            </label>

            <label className="field">
              <span className="field__label">Prioridade</span>
              <select
                className="input"
                value={draft.prioridade}
                onChange={set("prioridade")}
                disabled={!podeEditar}
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {ROTULO_PRIORIDADE[p]}
                  </option>
                ))}
              </select>
            </label>

            {emAnalise && (
              <label className="field">
                <span className="field__label">Usuário da análise *</span>
                <select
                  className="input"
                  value={draft.usuarioAnaliseId}
                  onChange={set("usuarioAnaliseId")}
                  disabled={!podeEditar}
                >
                  <option value="">Selecione…</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
                <span className="field__hint">Quem está validando o que o projetista entregou.</span>
              </label>
            )}

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
            <DateField label="Prazo previsto" value={draft.prazoPrevisto} onChange={setPrazoPrevisto} disabled={!podeEditar} />
            <DateField label="Prazo reprogramado" value={draft.prazoReprogramado} onChange={set("prazoReprogramado")} disabled={!podeEditar} />
            <DateField label="Prazo realizado" value={draft.prazoRealizado} onChange={setPrazoRealizado} disabled={!podeEditar} />

          </div>

          <label className="field field--checkbox" style={{ marginTop: "14px" }}>
            <input
              type="checkbox"
              checked={draft.enviadoAutodoc}
              onChange={setChecked("enviadoAutodoc")}
              disabled={!podeEditar}
            />
            <span className="field__label">Enviado para o Autodoc</span>
          </label>

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
              <div className="field__label">Revisão</div>
              <div className="mono">
                {item.revisaoAtual}
                {item.dataRevisao ? ` · ${formatBR(item.dataRevisao)}` : ""}
              </div>
              {item.emRevisao && (
                <div className="field__hint" style={{ marginTop: "2px" }}>
                  Revisão em aberto — o número só avança no envio ao Autodoc.
                </div>
              )}
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

          {revisoes && revisoes.length > 0 && (
            <div className="drawer-history">
              <div className="field__label" style={{ marginBottom: "10px" }}>
                Histórico de revisões
              </div>
              {revisoes.map((r) => (
                <div key={r.id} className="rev-row">
                  <div className="rev-row__head">
                    <span className="mono rev-row__num">{rotuloRevisao(r.numero)}</span>
                    <span className={`badge badge--${r.realizadaEm ? "verde" : "ambar"}`}>
                      <span className="badge__dot" />
                      {r.realizadaEm ? "Entregue" : "Em aberto"}
                    </span>
                  </div>
                  <div className="rev-row__solicitacao">{r.solicitacao}</div>
                  <div className="rev-row__datas mono">
                    Solicitada em {formatBR(r.solicitadaEm)} · Realizada em{" "}
                    {formatBR(r.realizadaEm)}
                    {r.projetistaNome ? ` · ${r.projetistaNome}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}

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
            <button
              type="button"
              className="btn-soft"
              onClick={() => setModalRevisao(true)}
              disabled={!podeRevisar || salvando}
              title={
                podeRevisar
                  ? "Abrir uma nova revisão do item"
                  : item.emRevisao
                    ? "Já existe uma revisão em aberto neste item"
                    : "Disponível apenas com o item Finalizado"
              }
            >
              Nova revisão
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

      {modalRevisao && (
        <NovaRevisaoModal
          item={item}
          projetista={projetistaDoItem}
          onClose={() => setModalRevisao(false)}
          onSalvo={() => {
            setModalRevisao(false);
            router.refresh();
            // O item mudou por completo (datas zeradas, Autodoc desmarcado):
            // fechar evita salvar por cima com um rascunho já obsoleto.
            onClose();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Nova revisão
 * ------------------------------------------------------------------ */

/**
 * Abre uma revisão de um item já finalizado. Além do texto da solicitação,
 * mostra a quem ela vai — o projetista do item e o e-mail dele —, para o
 * pedido não ser escrito sem se saber quem vai recebê-lo.
 */
function NovaRevisaoModal({
  item,
  projetista,
  onClose,
  onSalvo,
}: {
  item: ItemComRefs;
  projetista: Projetista | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [solicitacao, setSolicitacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    if (salvando) return;
    onClose();
  }

  async function salvar() {
    if (!solicitacao.trim()) {
      setErro("Descreva a solicitação da revisão.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await abrirRevisao(item.id, solicitacao);
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao abrir a revisão.");
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="modal-overlay" onClick={fechar} />
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2 className="modal-title">Nova revisão</h2>
          <button type="button" className="drawer-close" onClick={fechar} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="rev-destinatario">
            <div className="field__label">Projetista responsável</div>
            <div className="rev-destinatario__nome">{projetista?.nome ?? "Sem projetista"}</div>
            <div className="rev-destinatario__email mono">
              {projetista?.email || "sem e-mail cadastrado"}
            </div>
          </div>

          <label className="field" style={{ marginTop: "14px" }}>
            <span className="field__label">Solicitação da revisão *</span>
            <textarea
              className="input"
              rows={6}
              value={solicitacao}
              onChange={(e) => setSolicitacao(e.target.value)}
              placeholder="Descreva o que precisa ser revisado no projeto…"
              style={{ resize: "vertical" }}
              autoFocus
            />
            <span className="field__hint">
              O item volta para o início do ciclo: as datas são zeradas, a data
              de início passa a ser hoje e o Autodoc é desmarcado.
            </span>
          </label>
        </div>

        <div className="modal-foot">
          {erro && <span className="drawer-foot__erro">{erro}</span>}
          <button type="button" className="btn-soft" onClick={fechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Abrindo…" : "Abrir revisão"}
          </button>
        </div>
      </div>
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
