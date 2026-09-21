"use client";

/* ------------------------------------------------------------------ *
 * Ciclo de vida do empreendimento — um item por linha, barra do início
 * ao prazo/entrega. A cor NUNCA é escolhida à mão: vem de derivarStatus,
 * a mesma fonte do resto do painel de indicadores. Clicar numa barra abre
 * o MESMO drawer de edição usado no quadro de itens — sem formulário
 * duplicado.
 * ------------------------------------------------------------------ */

import { useMemo, useState } from "react";
import type { Etapa, Projetista } from "@/db/schema";
import type { ItemComRefs } from "@/lib/actions/itens";
import type { UsuarioBasico } from "@/lib/actions/usuarios";
import { derivarStatus, formatBR, parseISO } from "@/lib/ui/status";
import { ORDEM_PILHA, TOM_GRAFICO } from "@/lib/ui/charts";
import { ROTULO_ESTADO } from "@/lib/ui/indicadores";
import { ItemDrawer } from "./ItensBoard";
import { ChartCard, Legenda } from "./indicadores/Chrome";

type Linha = {
  item: ItemComRefs;
  rotulo: string;
  inicio: number;
  fim: number;
  tom: ReturnType<typeof derivarStatus>["tom"];
  rotuloStatus: string;
  desvio: string;
  inicioISO: string | null;
  fimISO: string | null;
};

/** Diferença em dias entre dois Date locais (mesmo TZ nos dois lados). */
function diffDias(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** Soma `n` dias a uma data local — sem passar por epoch/UTC. */
function somaDias(base: Date, n: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
}

function rotuloDiaMesData(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function CicloDeVidaGantt({
  itens,
  hojeISO,
  nomeEmpreendimento,
  etapas,
  projetistas,
  usuarios,
  podeEditar,
}: {
  itens: ItemComRefs[];
  hojeISO: string;
  nomeEmpreendimento: string;
  etapas: Etapa[];
  projetistas: Projetista[];
  usuarios: UsuarioBasico[];
  podeEditar: boolean;
}) {
  const hoje = useMemo(() => parseISO(hojeISO) ?? new Date(), [hojeISO]);
  const [itemAberto, setItemAberto] = useState<ItemComRefs | null>(null);

  const dados = useMemo(() => {
    // Âncora arbitrária: a primeira data de início encontrada (ou hoje, se
    // não houver nenhuma). Todo o resto é medido em dias a partir dela —
    // evita aritmética de epoch/UTC, que desloca datas perto da virada do dia.
    const primeiraData =
      itens
        .map((it) => parseISO(it.dataInicio))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? hoje;

    const linhas: Linha[] = [];
    let semData = 0;

    for (const it of itens) {
      const fimISO = it.prazoRealizado ?? it.prazoReprogramado ?? it.prazoPrevisto ?? it.dataInicio;
      const inicioData = parseISO(it.dataInicio) ?? parseISO(fimISO);
      const fimData = parseISO(fimISO) ?? inicioData;
      if (!inicioData || !fimData) {
        semData++;
        continue;
      }
      const status = derivarStatus(it, hoje);
      const numero = it.item != null ? String(it.item).padStart(2, "0") : "—";
      linhas.push({
        item: it,
        rotulo: `${numero} · ${it.disciplinaNome} — ${it.etapaNome}`,
        inicio: diffDias(inicioData, primeiraData),
        fim: Math.max(diffDias(inicioData, primeiraData), diffDias(fimData, primeiraData)),
        tom: status.tom,
        rotuloStatus: status.rotulo,
        desvio: status.desvio,
        inicioISO: it.dataInicio,
        fimISO,
      });
    }

    linhas.sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);

    const hojeOffset = diffDias(hoje, primeiraData);

    if (linhas.length === 0) {
      return {
        linhas,
        semData,
        primeiraData,
        hojeOffset,
        dominioIni: hojeOffset - 7,
        dominioFim: hojeOffset + 7,
        totalIni: hojeOffset,
        totalFim: hojeOffset,
      };
    }

    const totalIni = Math.min(...linhas.map((l) => l.inicio));
    const totalFim = Math.max(...linhas.map((l) => l.fim));
    // Margem de leitura nas pontas do eixo, e garante que "hoje" caiba dentro.
    const margem = Math.max(3, Math.round((totalFim - totalIni) * 0.06));
    const dominioIni = Math.min(totalIni, hojeOffset) - margem;
    const dominioFim = Math.max(totalFim, hojeOffset) + margem;

    return { linhas, semData, primeiraData, hojeOffset, dominioIni, dominioFim, totalIni, totalFim };
  }, [itens, hoje]);

  const { linhas, semData, primeiraData, hojeOffset, dominioIni, dominioFim, totalIni, totalFim } = dados;
  const span = Math.max(1, dominioFim - dominioIni);
  const pct = (offset: number) => ((offset - dominioIni) / span) * 100;

  const ticks = useMemo(() => {
    const out: { esquerda: number; rotulo: string }[] = [];
    // Alinha os ticks em intervalos de 7 dias, sempre um pouco antes do
    // domínio — evita um primeiro tick "solto" perto da margem esquerda.
    const passo = 7;
    const inicioTick = Math.floor(dominioIni / passo) * passo;
    for (let d = inicioTick; d <= dominioFim; d += passo) {
      if (d < dominioIni - passo || d > dominioFim + passo) continue;
      out.push({ esquerda: pct(d), rotulo: rotuloDiaMesData(somaDias(primeiraData, d)) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominioIni, dominioFim, primeiraData]);

  const estadosPresentes = ORDEM_PILHA.filter((t) => linhas.some((l) => l.tom === t));

  return (
    <>
      <ChartCard
        col={12}
        titulo="Ciclo de vida do empreendimento"
        pergunta="Quando cada item começou e terminou (ou deve terminar), comparado a hoje. Clique numa barra para abrir o item."
        vazio={
          linhas.length === 0 ? "Nenhum item com data de início ou prazo cadastrado neste empreendimento." : null
        }
        nota={
          semData > 0
            ? `${semData} ${semData === 1 ? "item" : "itens"} sem data de início ou prazo — não ${
                semData === 1 ? "aparece" : "aparecem"
              } no gráfico.`
            : undefined
        }
      >
        <div className="gantt">
          <div className="gantt__overlay" aria-hidden="true">
            {ticks.map((t, i) => (
              <span key={i} className="gantt__gridline" style={{ left: `${t.esquerda}%` }} />
            ))}
            {hojeOffset >= dominioIni && hojeOffset <= dominioFim && (
              <span className="gantt__hoje-linha" style={{ left: `${pct(hojeOffset)}%` }} />
            )}
          </div>

          <div className="gantt__row gantt__head">
            <div className="gantt__label-col" />
            <div className="gantt__track-col gantt__head-ticks">
              {ticks.map((t, i) => (
                <span key={i} className="gantt__tick" style={{ left: `${t.esquerda}%` }}>
                  {t.rotulo}
                </span>
              ))}
              {hojeOffset >= dominioIni && hojeOffset <= dominioFim && (
                <span className="gantt__tick gantt__tick--hoje" style={{ left: `${pct(hojeOffset)}%` }}>
                  hoje
                  <br />
                  {rotuloDiaMesData(somaDias(primeiraData, hojeOffset))}
                </span>
              )}
            </div>
          </div>

          <div className="gantt__row gantt__row--total">
            <div className="gantt__label-col gantt__label" title={nomeEmpreendimento}>
              {nomeEmpreendimento}
            </div>
            <div className="gantt__track-col gantt__track">
              <div
                className="gantt__bar gantt__bar--total"
                style={{
                  left: `${pct(totalIni)}%`,
                  width: `${Math.max(0.6, pct(totalFim) - pct(totalIni))}%`,
                }}
              >
                {nomeEmpreendimento}
              </div>
            </div>
          </div>

          {linhas.map((l) => (
            <div
              className="gantt__row gantt__row--item"
              key={l.item.id}
              role="button"
              tabIndex={0}
              onClick={() => setItemAberto(l.item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setItemAberto(l.item);
                }
              }}
            >
              <div className="gantt__label-col gantt__label" title={l.rotulo}>
                {l.rotulo}
              </div>
              <div className="gantt__track-col gantt__track">
                <div
                  className="gantt__bar"
                  style={{
                    left: `${pct(l.inicio)}%`,
                    width: `${Math.max(0.5, pct(l.fim) - pct(l.inicio))}%`,
                    background: TOM_GRAFICO[l.tom],
                  }}
                  title={`${l.rotulo}\n${l.rotuloStatus} · ${l.desvio}\nInício: ${formatBR(l.inicioISO)} · Alvo/entrega: ${formatBR(l.fimISO)}`}
                />
              </div>
            </div>
          ))}
        </div>

        {linhas.length > 0 && (
          <Legenda
            itens={estadosPresentes.map((t) => ({ chave: t, rotulo: ROTULO_ESTADO[t], cor: TOM_GRAFICO[t] }))}
          />
        )}
      </ChartCard>

      {itemAberto && (
        <ItemDrawer
          key={itemAberto.id}
          item={itemAberto}
          etapas={etapas}
          projetistas={projetistas}
          usuarios={usuarios}
          podeEditar={podeEditar}
          hoje={hoje}
          onClose={() => setItemAberto(null)}
        />
      )}
    </>
  );
}
