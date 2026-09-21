"use client";

/* ------------------------------------------------------------------ *
 * Barra de filtros — uma linha só, acima de tudo que ela recorta.
 * Nenhum gráfico tem filtro próprio: se dois cards pudessem discordar do
 * recorte, os números da tela parariam de fechar entre si.
 * ------------------------------------------------------------------ */

import { useEffect, useRef, useState } from "react";
import type { Filtros, Periodo } from "@/lib/ui/indicadores";
import { contarFiltros } from "@/lib/ui/indicadores";

export type Opcao = { id: string; nome: string; cor?: string };

const PERIODOS: { v: Periodo; label: string }[] = [
  { v: "30", label: "30 dias" },
  { v: "90", label: "90 dias" },
  { v: "180", label: "6 meses" },
  { v: "365", label: "12 meses" },
  { v: "tudo", label: "Tudo" },
];

function Multi({
  rotulo,
  opcoes,
  selecionados,
  onChange,
}: {
  rotulo: string;
  opcoes: Opcao[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  if (opcoes.length === 0) return null;
  const n = selecionados.length;

  return (
    <div className="ind-multi" ref={ref}>
      <button
        type="button"
        className={`ind-multi__btn${n > 0 ? " ind-multi__btn--on" : ""}`}
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
      >
        {rotulo}
        {n > 0 && <span className="ind-multi__contador">{n}</span>}
      </button>
      {aberto && (
        <div className="ind-multi__painel" role="listbox" aria-multiselectable>
          {n > 0 && (
            <button type="button" className="ind-multi__opcao" onClick={() => onChange([])}>
              <span className="ind-multi__check" />
              <span style={{ color: "var(--muted)" }}>Limpar {rotulo.toLowerCase()}</span>
            </button>
          )}
          {opcoes.map((o) => {
            const on = selecionados.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={on}
                className="ind-multi__opcao"
                onClick={() =>
                  onChange(on ? selecionados.filter((i) => i !== o.id) : [...selecionados, o.id])
                }
              >
                <span className="ind-multi__check">{on ? "✓" : ""}</span>
                {o.cor && <span className="ind-multi__swatch" style={{ background: o.cor }} />}
                <span>{o.nome}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FiltrosBar({
  filtros,
  set,
  limpar,
  opcoes,
  total,
  mostrados,
  onVerItens,
}: {
  filtros: Filtros;
  set: (patch: Partial<Filtros>) => void;
  limpar: () => void;
  opcoes: {
    empreendimentos: Opcao[];
    tipos: Opcao[];
    fases: Opcao[];
    disciplinas: Opcao[];
    categorias: Opcao[];
    etapas: Opcao[];
    projetistas: Opcao[];
    prioridades: Opcao[];
    estados: Opcao[];
  };
  total: number;
  mostrados: number;
  /** Abre o painel com as linhas por trás do recorte atual. */
  onVerItens: () => void;
}) {
  const ativos = contarFiltros(filtros);

  return (
    <div className="ind-filtros">
      <div className="chips">
        {PERIODOS.map((p) => (
          <button
            key={p.v}
            type="button"
            className={`chip${filtros.periodo === p.v ? " chip--on" : ""}`}
            onClick={() => set({ periodo: p.v })}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="ind-filtros__sep" />

      <Multi
        rotulo="Empreendimento"
        opcoes={opcoes.empreendimentos}
        selecionados={filtros.empreendimentos}
        onChange={(v) => set({ empreendimentos: v })}
      />
      <Multi rotulo="Tipo" opcoes={opcoes.tipos} selecionados={filtros.tipos} onChange={(v) => set({ tipos: v })} />
      <Multi rotulo="Fase" opcoes={opcoes.fases} selecionados={filtros.fases} onChange={(v) => set({ fases: v })} />
      <Multi
        rotulo="Disciplina"
        opcoes={opcoes.disciplinas}
        selecionados={filtros.disciplinas}
        onChange={(v) => set({ disciplinas: v })}
      />
      <Multi
        rotulo="Categoria"
        opcoes={opcoes.categorias}
        selecionados={filtros.categorias}
        onChange={(v) => set({ categorias: v })}
      />
      <Multi rotulo="Etapa" opcoes={opcoes.etapas} selecionados={filtros.etapas} onChange={(v) => set({ etapas: v })} />
      <Multi
        rotulo="Projetista"
        opcoes={opcoes.projetistas}
        selecionados={filtros.projetistas}
        onChange={(v) => set({ projetistas: v })}
      />
      <Multi
        rotulo="Prioridade"
        opcoes={opcoes.prioridades}
        selecionados={filtros.prioridades}
        onChange={(v) => set({ prioridades: v })}
      />
      <Multi
        rotulo="Estado"
        opcoes={opcoes.estados}
        selecionados={filtros.estados}
        onChange={(v) => set({ estados: v as Filtros["estados"] })}
      />

      <button
        type="button"
        className={`chip${filtros.apenasAbertos ? " chip--on" : ""}`}
        onClick={() => set({ apenasAbertos: !filtros.apenasAbertos })}
      >
        Só em aberto
      </button>

      <div className="ind-filtros__limpar">
        <button type="button" className="ind-ver-itens" onClick={onVerItens}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}>
            <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
            <line x1="1.5" y1="6.7" x2="14.5" y2="6.7" />
          </svg>
          <span className="mono">{mostrados === total ? `${total} itens` : `${mostrados} de ${total} itens`}</span>
        </button>
        {ativos > 0 && (
          <button type="button" className="btn-soft" onClick={limpar}>
            Limpar filtros ({ativos})
          </button>
        )}
      </div>
    </div>
  );
}
