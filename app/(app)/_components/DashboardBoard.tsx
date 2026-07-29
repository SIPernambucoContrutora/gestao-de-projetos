"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ItemDashboard } from "@/lib/actions/itens";
import type { StatusItem } from "@/db/schema";
import { derivarStatus, formatBR, parseISO } from "@/lib/ui/status";
import { StatusBadge } from "./StatusBadge";

type ChipKey = "all" | StatusItem | "atrasado";

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "finalizado", label: "Finalizados" },
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
    let fin = 0, and = 0, atr = 0;
    for (const i of doEmp) {
      const d = derivarStatus(i, hoje);
      if (i.status === "finalizado") fin++;
      else if (d.atrasado) atr++;
      else if (i.status === "em_andamento") and++;
    }
    const pct = doEmp.length ? Math.round((fin / doEmp.length) * 100) : 0;
    return { total: doEmp.length, fin, and, atr, pct };
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
    { label: "Atrasados", valor: String(metricas.atr), sub: "exigem reprogramação", dot: "vermelho" },
  ];

  return (
    <div>
      <header className="page-head">
        <div className="page-head__row">
          <div>
            <h1 className="page-head__title">Dashboard</h1>
            <p className="page-head__sub">Visão consolidada dos itens de projeto</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="dash-filtro-label">Empreendimento</span>
            <select className="input" value={fEmp} onChange={(e) => setFEmp(e.target.value)} style={{ minWidth: "220px" }}>
              <option value="all">Todos os empreendimentos</option>
              {empOptions.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
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
          <select className="input" value={fDisc} onChange={(e) => setFDisc(e.target.value)}>
            <option value="all">Todas as disciplinas</option>
            {discOptions.map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
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
        </div>

        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: "1040px" }}>
            <thead>
              <tr>
                <th style={{ width: "44px" }}>#</th>
                <th>Empreendimento</th>
                <th>Disciplina</th>
                <th>Etapa</th>
                <th>Projetista</th>
                <th>Status</th>
                <th>Previsto</th>
                <th>Reprog.</th>
                <th>Realizado</th>
                <th className="ta-right">Desvio</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={10} className="data-table__empty">Nenhum item corresponde aos filtros.</td>
                </tr>
              ) : (
                filtrados.map((it) => {
                  const d = derivarStatus(it, hoje);
                  const desvioNeg = d.desvioAtraso;
                  return (
                    <tr
                      key={it.id}
                      className={`row-item${d.atrasado ? " row-item--atrasado" : ""}`}
                      onClick={() => router.push(`/empreendimentos/${it.empreendimentoId}`)}
                    >
                      <td className="mono td-muted">{it.item != null ? String(it.item).padStart(2, "0") : "—"}</td>
                      <td className="td-muted">{it.empreendimentoNome}</td>
                      <td className="td-strong">{it.disciplinaNome}</td>
                      <td>{it.etapaNome}</td>
                      <td className="td-muted">{it.projetistaNome ?? "—"}</td>
                      <td><StatusBadge tom={d.tom} rotulo={d.rotulo} /></td>
                      <td className="mono td-muted">{formatBR(it.prazoPrevisto)}</td>
                      <td className="mono td-muted">{formatBR(it.prazoReprogramado)}</td>
                      <td className="mono td-muted">{formatBR(it.prazoRealizado)}</td>
                      <td className={`mono ta-right${desvioNeg ? " td-danger" : " td-muted"}`}>{d.desvio}</td>
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
