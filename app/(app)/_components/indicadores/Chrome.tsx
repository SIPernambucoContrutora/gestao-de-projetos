"use client";

/* ------------------------------------------------------------------ *
 * Peças comuns a todos os gráficos: o card, o tooltip, a legenda e os
 * eixos. Ficam num arquivo só para a aparência ser decidida UMA vez —
 * um gráfico novo não escolhe tipografia, grade nem cor de eixo.
 * ------------------------------------------------------------------ */

import { useId, useState } from "react";
import { CHART } from "@/lib/ui/charts";
import type { Tom } from "@/lib/ui/status";

/* ------------------------------------------------------------------ *
 * Cartão de KPI
 *
 * Reaproveita .metric do dashboard de propósito: o indicador é outra
 * leitura dos mesmos dados, não outro produto.
 * ------------------------------------------------------------------ */

export function Kpi({
  rotulo,
  valor,
  sub,
  tom,
}: {
  rotulo: string;
  valor: string;
  sub: string;
  tom: Tom;
}) {
  return (
    <div className="metric">
      <div className="metric__top">
        <span className={`dot dot--${tom}`} />
        <span className="metric__label">{rotulo}</span>
      </div>
      <div className="metric__value">{valor}</div>
      <div className="metric__sub">{sub}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

export type ColunaTabela = { chave: string; rotulo: string; numerica?: boolean };

export function ChartCard({
  titulo,
  pergunta,
  col = 6,
  nota,
  vazio,
  tabela,
  children,
}: {
  titulo: string;
  /** A pergunta que o gráfico responde — é isso que justifica ele existir. */
  pergunta: string;
  col?: 4 | 6 | 8 | 12;
  nota?: string;
  /** Mensagem quando não há dado suficiente (em vez de um gráfico vazio). */
  vazio?: string | null;
  /**
   * Visão em tabela dos mesmos números. Não é enfeite: é o caminho de quem
   * não enxerga cor, não usa mouse ou vai copiar o dado para outro lugar.
   */
  tabela?: { colunas: ColunaTabela[]; linhas: Record<string, string>[] };
  children: React.ReactNode;
}) {
  const [verTabela, setVerTabela] = useState(false);
  const idTabela = useId();

  return (
    <div className={`ind-card ind-col-${col}`}>
      <div className="ind-card__head">
        <div>
          <h3 className="ind-card__titulo">{titulo}</h3>
          <p className="ind-card__pergunta">{pergunta}</p>
        </div>
        {tabela && !vazio && (
          <button
            type="button"
            className="ind-card__tabela-btn"
            onClick={() => setVerTabela((v) => !v)}
            aria-expanded={verTabela}
            aria-controls={idTabela}
          >
            {verTabela ? "Ver gráfico" : "Ver tabela"}
          </button>
        )}
      </div>

      {vazio ? (
        <div className="ind-card__vazio">{vazio}</div>
      ) : verTabela && tabela ? (
        <div className="ind-tab__wrap" id={idTabela}>
          <table className="ind-tab">
            <thead>
              <tr>
                {tabela.colunas.map((c) => (
                  <th key={c.chave} className={c.numerica ? "ta-right" : undefined}>
                    {c.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.linhas.map((l, i) => (
                <tr key={i}>
                  {tabela.colunas.map((c) => (
                    <td key={c.chave} className={c.numerica ? "ta-right" : undefined}>
                      {l[c.chave] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}

      {nota && !vazio && <p className="ind-card__nota">{nota}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tooltip
 *
 * O valor lidera e o nome da série segue: quem está com o ponteiro em
 * cima já sabe qual série é, o que ele quer é o número.
 * ------------------------------------------------------------------ */

type ItemTip = { nome: string; valor: string; cor: string };

export function Tip({ titulo, itens }: { titulo: string; itens: ItemTip[] }) {
  return (
    <div className="ind-tip">
      <div className="ind-tip__titulo">{titulo}</div>
      {itens.map((i, k) => (
        <div className="ind-tip__linha" key={k}>
          <span className="ind-tip__key" style={{ background: i.cor }} />
          <span className="ind-tip__valor">{i.valor}</span>
          <span className="ind-tip__nome">{i.nome}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Adaptador para o `content` do Tooltip do Recharts. `formatar` decide o
 * texto de cada série — o default é o valor cru.
 */
export function tooltipRecharts(
  formatar?: (valor: number, nome: string) => string,
  tituloDe?: (label: string) => string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function Conteudo({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const itens: ItemTip[] = payload
      // Séries zeradas viram ruído numa pilha de seis estados.
      .filter((p: any) => p.value !== null && p.value !== undefined && p.value !== 0)
      .map((p: any) => ({
        nome: String(p.name ?? ""),
        valor: formatar ? formatar(Number(p.value), String(p.name ?? "")) : String(p.value),
        cor: p.color ?? p.fill ?? CHART.texto,
      }));
    if (itens.length === 0) return null;
    return <Tip titulo={tituloDe ? tituloDe(String(label)) : String(label)} itens={itens} />;
  };
}

/* ------------------------------------------------------------------ *
 * Legenda
 *
 * Própria (não a do Recharts) por duas razões: o texto fica em tinta de
 * texto, nunca na cor da série, e cada item pode virar um filtro.
 * ------------------------------------------------------------------ */

export function Legenda({
  itens,
  ativos,
  onClick,
}: {
  itens: { chave: string; rotulo: string; cor: string }[];
  /** Lista vazia = todos ativos. */
  ativos?: string[];
  onClick?: (chave: string) => void;
}) {
  if (itens.length < 2) return null;
  return (
    <div className="ind-legenda">
      {itens.map((i) => {
        const off = ativos && ativos.length > 0 && !ativos.includes(i.chave);
        const Tag = onClick ? "button" : "span";
        return (
          <Tag
            key={i.chave}
            type={onClick ? "button" : undefined}
            className={`ind-legenda__item${off ? " ind-legenda__item--off" : ""}`}
            onClick={onClick ? () => onClick(i.chave) : undefined}
            style={onClick ? undefined : { cursor: "default" }}
          >
            <span className="ind-legenda__swatch" style={{ background: i.cor }} />
            {i.rotulo}
          </Tag>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Eixos e grade — recessivos, sempre iguais
 * ------------------------------------------------------------------ */

export const EIXO = {
  tick: { fill: CHART.texto, fontSize: 11 },
  axisLine: { stroke: CHART.eixo },
  tickLine: false as const,
};

export const GRADE = {
  stroke: CHART.grade,
  strokeWidth: 1,
  vertical: false,
};

/** Margem padrão: espaço para o rótulo do eixo sem sobra desperdiçada. */
export const MARGEM = { top: 8, right: 16, bottom: 4, left: 0 };

/** Barras finas com topo arredondado — o padrão de marca do painel. */
export const BARRA_MAX = 24;
export const RAIO_TOPO: [number, number, number, number] = [4, 4, 0, 0];
export const RAIO_DIREITA: [number, number, number, number] = [0, 4, 4, 0];
