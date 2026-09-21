"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ItemDashboard } from "@/lib/actions/itens";
import type { StatusItem } from "@/db/schema";
import { derivarStatus, formatBR, parseISO } from "@/lib/ui/status";
import { AutodocBadge, DesvioBadge, PrioridadeBadge, StatusBadge } from "./StatusBadge";

type ChipKey = "all" | StatusItem | "atrasado";

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "finalizado", label: "Finalizados" },
  { key: "em_analise", label: "Em análise" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "atrasado", label: "Atrasados" },
  { key: "pendente", label: "Pendentes" },
];

export function DashboardBoard({ itens, hojeISO }: { itens: ItemDashboard[]; hojeISO: string }) {
  const router = useRouter();
  const hoje = useMemo(() => parseISO(hojeISO) ?? new Date(), [hojeISO]);

  const [fEmp, setFEmp] = useState("all");
  const [fDisc, setFDisc] = useState("all");
  const [fStatus, setFStatus] = useState<ChipKey>("all");
  const [busca, setBusca] = useState("");

  // Opções de filtro derivadas dos próprios itens.
  const empOptions = useMemo(() => {
    const m = new Map<string, string>();
    itens.forEach((i) => m.set(i.empreendimentoId, i.empreendimentoNome));
    return [...m.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [itens]);

  const discOptions = useMemo(() => {
    const m = new Map<string, string>();
    itens.forEach((i) => m.set(i.disciplinaId, i.disciplinaNome));
    return [...m.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [itens]);

  // Métricas: refletem o filtro de empreendimento apenas (como no protótipo).
  const doEmp = useMemo(
    () => (fEmp === "all" ? itens : itens.filter((i) => i.empreendimentoId === fEmp)),
    [itens, fEmp],
  );

  const metricas = useMemo(() => {
    let fin = 0, and = 0, atr = 0, pend = 0, ana = 0;
    for (const i of doEmp) {
      const d = derivarStatus(i, hoje);
      if (i.status === "finalizado") fin++;
      else if (d.atrasado) atr++;
      else if (i.status === "em_andamento") and++;
      if (i.status === "pendente") pend++;
      if (i.status === "em_analise") ana++;
    }
    const base = doEmp.length;
    const pct = base ? Math.round((fin / base) * 100) : 0;
    return { total: doEmp.length, fin, and, atr, pend, ana, pct };
  }, [doEmp, hoje]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return doEmp.filter((it) => {
      if (fDisc !== "all" && it.disciplinaId !== fDisc) return false;
      if (q) {
        const hay = `${it.planta ?? ""} ${it.disciplinaNome} ${it.etapaNome} ${it.empreendimentoNome}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fStatus !== "all") {
        const d = derivarStatus(it, hoje);
        if (fStatus === "atrasado") return d.atrasado;
        return it.status === fStatus && !d.atrasado;
      }
      return true;
    });
  }, [doEmp, fDisc, fStatus, busca, hoje]);

  const cards = [
    { label: "Total de itens", valor: String(metricas.total), sub: fEmp === "all" ? `${empOptions.length} empreendimentos` : "no empreendimento", dot: "cinza" },
    { label: "Finalizados", valor: `${metricas.pct}%`, sub: `${metricas.fin} de ${metricas.total} itens`, dot: "verde" },
    { label: "Em andamento", valor: String(metricas.and), sub: "dentro do prazo", dot: "ambar" },
    { label: "Em análise", valor: String(metricas.ana), sub: "aguardando validação", dot: "azul" },
    { label: "Atrasados", valor: String(metricas.atr), sub: "exigem reprogramação", dot: "vermelho" },
    { label: "Pendentes", valor: String(metricas.pend), sub: "aguardando início", dot: "cinza" },
  ];

  return (
    <div>
      <header className="page-head">
        <div className="page-head__row">
          <div>
            <h1 className="page-head__title">Dashboard</h1>
            <p className="page-head__sub">Visão consolidada dos itens de projeto</p>
          </div>
          {/* Porta de entrada dos gráficos. O dashboard é a tela de EXECUTAR
              (a tabela, item a item); Indicadores é a de DECIDIR — leva o
              empreendimento selecionado aqui junto no recorte. Fica ao lado
              do título, na mesma linha — os filtros abaixo são outra coisa
              (escopo da tabela), não companhia do botão. */}
          <Link
            href={fEmp === "all" ? "/indicadores" : `/indicadores?emp=${fEmp}`}
            className="btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none", flex: "none" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <line x1="2" y1="14" x2="14" y2="14" />
              <rect x="3" y="8.5" width="2.6" height="5.5" />
              <rect x="6.9" y="4.5" width="2.6" height="9.5" />
              <rect x="10.8" y="6.8" width="2.6" height="7.2" />
            </svg>
            Indicadores
          </Link>
        </div>

        <div className="dash-filtros-row">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="dash-filtro-label">Empreendimento</span>
            <select className="input" value={fEmp} onChange={(e) => setFEmp(e.target.value)} style={{ minWidth: "220px" }}>
              <option value="all">Todos os empreendimentos</option>
              {empOptions.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="dash-filtro-label">Disciplina</span>
            <select className="input" value={fDisc} onChange={(e) => setFDisc(e.target.value)} style={{ minWidth: "200px" }}>
              <option value="all">Todas as disciplinas</option>
              {discOptions.map((d) => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="metrics">
          {cards.map((c) => (
            <div key={c.label} className="metric">
              <div className="metric__top">
                <span className={`dot dot--${c.dot}`} />
                <span className="metric__label">{c.label}</span>
              </div>
              <div className="metric__value mono">{c.valor}</div>
              <div className="metric__sub">{c.sub}</div>
            </div>
          ))}
        </div>
      </header>

      <section className="board">
        <div className="board-toolbar">
          <input
            className="input"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar planta, escopo, disciplina ou empreendimento…"
            style={{ width: "300px" }}
          />
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
        </div>

        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: "1800px" }}>
            <thead>
              <tr>
                <th>Empreendimento</th>
                <th>Disciplina</th>
                <th>Etapa</th>
                <th style={{ minWidth: "420px" }}>Planta / escopo</th>
                <th>Projetista</th>
                <th style={{ width: "72px" }}>Revisão</th>
                <th>Status</th>
                <th>Prioridade</th>
                <th>Data início</th>
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
                  <td colSpan={14} className="data-table__empty">Nenhum item corresponde aos filtros.</td>
                </tr>
              ) : (
                filtrados.map((it) => {
                  const d = derivarStatus(it, hoje);
                  return (
                    <tr
                      key={it.id}
                      className={`row-item${d.atrasado ? " row-item--atrasado" : ""}`}
                      onClick={() => router.push(`/empreendimentos/${it.empreendimentoId}`)}
                    >
                      <td className="td-muted">{it.empreendimentoNome}</td>
                      <td className="td-strong">{it.disciplinaNome}</td>
                      <td>{it.etapaNome}</td>
                      <td className="td-wide">{it.planta ?? "—"}</td>
                      <td className="td-muted">{it.projetistaNome ?? "—"}</td>
                      <td className="mono td-muted">{it.revisaoAtual}</td>
                      <td><StatusBadge tom={d.tom} rotulo={d.rotulo} /></td>
                      <td><PrioridadeBadge prioridade={it.prioridade} /></td>
                      <td className="mono td-muted">{formatBR(it.dataInicio)}</td>
                      <td className="mono td-muted">{formatBR(it.prazoPrevisto)}</td>
                      <td className="mono td-muted">{formatBR(it.prazoReprogramado)}</td>
                      <td className="mono td-muted">{formatBR(it.prazoRealizado)}</td>
                      <td className="ta-right"><DesvioBadge tom={d.desvioTom} texto={d.desvio} /></td>
                      <td><AutodocBadge enviado={it.enviadoAutodoc} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
