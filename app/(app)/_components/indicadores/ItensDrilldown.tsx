"use client";

/* ------------------------------------------------------------------ *
 * Painel de itens (drill-through) — o elo entre um gráfico e o dado que
 * ele resume. Todo cartão de Indicadores conta um agregado; este painel
 * mostra as LINHAS que compõem esse agregado, na mesma leitura de estado
 * (derivarStatus), e deixa abrir o item para editar — o mesmo drawer que
 * /empreendimentos/[id] usa, sem duplicar formulário nem Server Action.
 *
 * Abre em três situações, todas pelo mesmo painel:
 *   · a pessoa clica numa marca ligada a uma DIMENSÃO do filtro (estado,
 *     disciplina, projetista, empreendimento) — o clique ajusta o filtro
 *     global e o painel mostra o recorte inteiro resultante;
 *   · a pessoa clica numa marca que NÃO é uma dimensão de filtro (um dia
 *     do calendário, uma semana de entregas, uma faixa de aging, uma
 *     célula de matriz) — o painel mostra só aquele subconjunto pontual,
 *     sem mexer no filtro global (não existe "filtro de dia 21/09");
 *   · a pessoa clica no contador "N de M itens" da barra de filtros, para
 *     revisar o recorte atual sem passar por gráfico nenhum.
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import type { LinhaIndicador } from "@/lib/actions/analytics";
import { derivarStatus, formatBR, parseISO } from "@/lib/ui/status";
import { AutodocBadge, DesvioBadge, PrioridadeBadge, StatusBadge } from "../StatusBadge";

/** Teto de linhas renderizadas — acima disso o painel vira uma segunda
 *  tabela de verdade, e é para isso que a tela de Empreendimentos existe. */
const TETO = 500;

export function ItensDrilldown({
  itens,
  titulo,
  subtitulo,
  hojeISO,
  onAbrirItem,
  onClose,
}: {
  itens: LinhaIndicador[];
  /** O que foi clicado — "Atrasados", "Vence em 21/09/2026", etc. */
  titulo: string;
  /** Explica de onde veio o recorte, quando o título sozinho não basta. */
  subtitulo?: string;
  hojeISO: string;
  onAbrirItem: (item: LinhaIndicador) => void;
  onClose: () => void;
}) {
  const hoje = useMemo(() => parseISO(hojeISO) ?? new Date(), [hojeISO]);

  // Mesma ordem de trabalho do dashboard: pendente no topo, finalizado por
  // último, e dentro do grupo a data-alvo mais próxima primeiro.
  const ordenados = useMemo(() => {
    const ordem: Record<string, number> = { pendente: 0, em_andamento: 1, em_analise: 2, finalizado: 3 };
    return [...itens].sort((a, b) => {
      const oa = ordem[a.status] ?? 4;
      const ob = ordem[b.status] ?? 4;
      if (oa !== ob) return oa - ob;
      const da = a.prazoReprogramado ?? a.prazoPrevisto ?? "9999";
      const db_ = b.prazoReprogramado ?? b.prazoPrevisto ?? "9999";
      return da.localeCompare(db_);
    });
  }, [itens]);

  const mostrados = ordenados.slice(0, TETO);

  return (
    <div>
      <div className="drawer-overlay drawer-overlay--list" onClick={onClose} />
      <aside
        className="drawer-panel drawer-panel--wide drawer-panel--list"
        role="dialog"
        aria-label={titulo}
      >
        <div className="drawer-head">
          <div>
            <div className="drawer-head__eyebrow mono">
              {itens.length} {itens.length === 1 ? "ITEM" : "ITENS"}
            </div>
            <h2 className="drawer-head__title">{titulo}</h2>
            <div className="drawer-head__sub">
              {subtitulo ?? "Clique numa linha para abrir e editar o item."}
            </div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="drawer-body" style={{ padding: 0 }}>
          {itens.length === 0 ? (
            <div className="ind-card__vazio" style={{ padding: "18px 22px" }}>
              Nenhum item corresponde a este recorte.
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empreendimento</th>
                    <th>Disciplina</th>
                    <th style={{ minWidth: "260px" }}>Planta / escopo</th>
                    <th>Projetista</th>
                    <th>Status</th>
                    <th>Prioridade</th>
                    <th>Previsto</th>
                    <th className="ta-right">Desvio</th>
                    <th>Autodoc</th>
                  </tr>
                </thead>
                <tbody>
                  {mostrados.map((it) => {
                    const d = derivarStatus(it, hoje);
                    return (
                      <tr
                        key={it.id}
                        className={`row-item${d.atrasado ? " row-item--atrasado" : ""}`}
                        onClick={() => onAbrirItem(it)}
                      >
                        <td className="td-muted">{it.empreendimentoNome}</td>
                        <td className="td-strong">{it.disciplinaNome}</td>
                        <td className="td-wide">{it.planta ?? "—"}</td>
                        <td className="td-muted">{it.projetistaNome ?? "—"}</td>
                        <td>
                          <StatusBadge tom={d.tom} rotulo={d.rotulo} />
                        </td>
                        <td>
                          <PrioridadeBadge prioridade={it.prioridade} />
                        </td>
                        <td className="mono td-muted">{formatBR(it.prazoPrevisto)}</td>
                        <td className="ta-right">
                          <DesvioBadge tom={d.desvioTom} texto={d.desvio} />
                        </td>
                        <td>
                          <AutodocBadge enviado={it.enviadoAutodoc} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {itens.length > TETO && (
                <p className="ind-card__nota" style={{ padding: "10px 22px" }}>
                  Mostrando os primeiros {TETO} de {itens.length} itens. Refine o filtro para ver o resto.
                </p>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
