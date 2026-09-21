"use client";

/* ------------------------------------------------------------------ *
 * Visão geral — onde a carteira está hoje, para onde ela anda e o que
 * vence adiante.
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LinhaIndicador } from "@/lib/actions/analytics";
import type { Tom } from "@/lib/ui/status";
import { parseISO } from "@/lib/ui/status";
import {
  CHART,
  ORDEM_PILHA,
  RAMPA_ATRASO,
  RAMPA_TEAL,
  TOM_GRAFICO,
  dias,
  num,
  passoRampa,
  pct,
  rotuloDiaMes,
} from "@/lib/ui/charts";
import { formatBR } from "@/lib/ui/status";
import {
  ROTULO_ESTADO,
  atrasoDias,
  contarEstados,
  emAberto,
  estado,
  mediana,
  noPrazo,
  prazoVigente,
  semanaDe,
  semanasEntre,
  taxa,
} from "@/lib/ui/indicadores";
import {
  BARRA_MAX,
  ChartCard,
  EIXO,
  GRADE,
  Kpi,
  Legenda,
  MARGEM,
  RAIO_TOPO,
  tooltipRecharts,
} from "./Chrome";

const FAIXAS_AGING = [
  { rotulo: "1–7 dias", min: 1, max: 7 },
  { rotulo: "8–15", min: 8, max: 15 },
  { rotulo: "16–30", min: 16, max: 30 },
  { rotulo: "31–60", min: 31, max: 60 },
  { rotulo: "60+", min: 61, max: Infinity },
];

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function AbaVisaoGeral({
  itens,
  hojeISO,
  estadosAtivos,
  onVerItens,
}: {
  itens: LinhaIndicador[];
  hojeISO: string;
  /** Vem da barra de filtros (manual) — só para destacar o que já está filtrado. */
  estadosAtivos: Tom[];
  /** Único jeito de ver os itens por trás de uma marca: abre o painel, nunca muda o filtro. */
  onVerItens: (itens: LinhaIndicador[], titulo: string, subtitulo?: string) => void;
}) {
  const hoje = useMemo(() => parseISO(hojeISO) ?? new Date(), [hojeISO]);

  /* ---------------- KPIs ---------------- */
  const kpis = useMemo(() => {
    const abertos = itens.filter(emAberto);
    const atrasos = abertos
      .map((l) => atrasoDias(l, hojeISO))
      .filter((d): d is number => d !== null);

    const entregues = itens.filter((l) => noPrazo(l) !== null);
    const dentro = entregues.filter((l) => noPrazo(l) === true).length;

    const reprog = itens.reduce((s, l) => s + l.reprogramacoes, 0);
    const empurrados = itens.reduce((s, l) => s + l.diasEmpurrados, 0);

    // Passaram por análise = já entregaram alguma vez (têm o marco).
    const analisados = itens.filter((l) => l.entregaProjetista !== null);
    const primeira = analisados.filter((l) => !l.teveAjustes).length;

    const filaAutodoc = itens.filter(
      (l) => (l.status === "finalizado" || !!l.prazoRealizado) && !l.enviadoAutodoc,
    ).length;

    return {
      total: itens.length,
      abertos: abertos.length,
      atrasados: atrasos.length,
      taxaAtraso: taxa(atrasos.length, abertos.length),
      agingMediano: mediana(atrasos),
      agingMax: atrasos.length ? Math.max(...atrasos) : null,
      aderencia: taxa(dentro, entregues.length),
      entregues: entregues.length,
      reprogPorItem: itens.length ? reprog / itens.length : null,
      empurrados,
      primeira: taxa(primeira, analisados.length),
      analisados: analisados.length,
      filaAutodoc,
    };
  }, [itens, hojeISO]);

  /* ---------------- Composição da carteira ---------------- */
  const composicao = useMemo(() => {
    const c = contarEstados(itens, hoje);
    const linha: Record<string, number | string> = { nome: "carteira" };
    for (const t of ORDEM_PILHA) linha[t] = c[t];
    return { dados: [linha], contagem: c };
  }, [itens, hoje]);

  /* ---------------- Séries semanais ---------------- */
  const serie = useMemo(() => {
    const datas = itens
      .flatMap((l) => [l.criadoEm, l.dataInicio, l.prazoRealizado])
      .filter((d): d is string => !!d && d <= hojeISO);
    if (datas.length === 0) return { semanas: [] as Record<string, number | string>[] };

    const inicio = datas.reduce((a, b) => (a < b ? a : b));
    const todas = semanasEntre(inicio, hojeISO);
    // Teto de leitura: 26 semanas cabem no eixo sem virar sopa de rótulos.
    const semanas = todas.slice(-26);

    const criadosPorSemana = new Map<string, number>();
    const entreguesPorSemana = new Map<string, number>();
    for (const l of itens) {
      if (l.criadoEm && l.criadoEm <= hojeISO) {
        const s = semanaDe(l.criadoEm);
        criadosPorSemana.set(s, (criadosPorSemana.get(s) ?? 0) + 1);
      }
      if (l.prazoRealizado && l.prazoRealizado <= hojeISO) {
        const s = semanaDe(l.prazoRealizado);
        entreguesPorSemana.set(s, (entreguesPorSemana.get(s) ?? 0) + 1);
      }
    }

    // Acumulado desde o começo de tudo (inclusive antes da janela exibida),
    // senão o burn-up começaria em zero e diria que a carteira nasceu ali.
    let accCriados = 0;
    let accEntregues = 0;
    const antes = todas.slice(0, todas.length - semanas.length);
    for (const s of antes) {
      accCriados += criadosPorSemana.get(s) ?? 0;
      accEntregues += entreguesPorSemana.get(s) ?? 0;
    }

    const linhas = semanas.map((s) => {
      accCriados += criadosPorSemana.get(s) ?? 0;
      accEntregues += entreguesPorSemana.get(s) ?? 0;
      return {
        semana: s,
        criados: accCriados,
        entregues: accEntregues,
        naSemana: entreguesPorSemana.get(s) ?? 0,
      };
    });

    // Média móvel de 4 semanas — mesma unidade das barras, mesmo eixo.
    const comMedia = linhas.map((l, i) => {
      const janela = linhas.slice(Math.max(0, i - 3), i + 1);
      const m = janela.reduce((s, x) => s + x.naSemana, 0) / janela.length;
      return { ...l, media: Math.round(m * 10) / 10 };
    });

    return { semanas: comMedia };
  }, [itens, hojeISO]);

  /* ---------------- Aging dos atrasos ---------------- */
  const aging = useMemo(() => {
    const valores = itens
      .filter(emAberto)
      .map((l) => atrasoDias(l, hojeISO))
      .filter((d): d is number => d !== null);
    return FAIXAS_AGING.map((f) => ({
      faixa: f.rotulo,
      itens: valores.filter((v) => v >= f.min && v <= f.max).length,
    }));
  }, [itens, hojeISO]);

  /* ---------------- Calendário de vencimentos ---------------- */
  const calendario = useMemo(() => {
    const abertos = itens.filter(emAberto);
    const porDia = new Map<string, number>();
    for (const l of abertos) {
      const p = prazoVigente(l);
      if (p) porDia.set(p, (porDia.get(p) ?? 0) + 1);
    }

    const base = parseISO(hojeISO);
    if (!base) return null;
    // 4 semanas para trás (o que venceu e não saiu) e 8 para frente.
    const ini = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 28);
    const fim = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 56);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const semanas = semanasEntre(iso(ini), iso(fim));
    const max = Math.max(1, ...porDia.values());

    const celulas = semanas.map((s) => {
      const seg = parseISO(s)!;
      return DIAS_SEMANA.map((_, i) => {
        const d = new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + i);
        const dia = iso(d);
        return { dia, qtd: porDia.get(dia) ?? 0, passado: dia < hojeISO, hoje: dia === hojeISO };
      });
    });

    return { semanas, celulas, max, totalAberto: abertos.length };
  }, [itens, hojeISO]);

  const legendaEstados = ORDEM_PILHA.map((t) => ({
    chave: t,
    rotulo: `${ROTULO_ESTADO[t]} (${composicao.contagem[t]})`,
    cor: TOM_GRAFICO[t],
  }));

  return (
    <>
      <div className="metrics" style={{ gridColumn: "span 12", padding: 0 }}>
        <Kpi
          rotulo="Taxa de atraso"
          valor={kpis.taxaAtraso === null ? "—" : pct(kpis.taxaAtraso)}
          sub={`${num(kpis.atrasados)} de ${num(kpis.abertos)} em aberto`}
          tom="vermelho"
        />
        <Kpi
          rotulo="Aging mediano"
          valor={kpis.agingMediano === null ? "—" : dias(kpis.agingMediano)}
          sub={kpis.agingMax === null ? "nenhum atraso" : `pior caso: ${dias(kpis.agingMax)}`}
          tom="ambar"
        />
        <Kpi
          rotulo="Aderência ao prazo"
          valor={kpis.aderencia === null ? "—" : pct(kpis.aderencia)}
          sub={`${num(kpis.entregues)} entregas medidas`}
          tom="verde"
        />
        <Kpi
          rotulo="Reprogramações"
          valor={kpis.reprogPorItem === null ? "—" : num(kpis.reprogPorItem, 2)}
          sub={`por item · ${num(kpis.empurrados)} dias empurrados`}
          tom="rosa"
        />
        <Kpi
          rotulo="Aprovação de primeira"
          valor={kpis.primeira === null ? "—" : pct(kpis.primeira)}
          sub={`${num(kpis.analisados)} itens analisados`}
          tom="azul"
        />
        <Kpi
          rotulo="Fila do Autodoc"
          valor={num(kpis.filaAutodoc)}
          sub="finalizados, ainda não enviados"
          tom="cinza"
        />
      </div>

      <ChartCard
        col={12}
        titulo="Composição da carteira"
        pergunta="Onde os itens estão parados agora? Clique num estado para ver os itens."
        vazio={itens.length === 0 ? "Nenhum item no recorte atual." : null}
        tabela={{
          colunas: [
            { chave: "estado", rotulo: "Estado" },
            { chave: "itens", rotulo: "Itens", numerica: true },
            { chave: "share", rotulo: "Participação", numerica: true },
          ],
          linhas: ORDEM_PILHA.map((t) => ({
            estado: ROTULO_ESTADO[t],
            itens: num(composicao.contagem[t]),
            share: pct(taxa(composicao.contagem[t], itens.length) ?? 0, 1),
          })),
        }}
      >
        <ResponsiveContainer width="100%" height={86}>
          <BarChart data={composicao.dados} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="nome" hide />
            <Tooltip
              cursor={false}
              content={tooltipRecharts(
                (v) => `${num(v)} ${v === 1 ? "item" : "itens"}`,
                () => "Carteira",
              )}
            />
            {ORDEM_PILHA.map((t) => (
              <Bar
                key={t}
                dataKey={t}
                name={ROTULO_ESTADO[t]}
                stackId="carteira"
                fill={TOM_GRAFICO[t]}
                barSize={40}
                // 2px de superfície separando os blocos — é o branco que
                // separa, não um contorno desenhado em volta.
                stroke={CHART.superficie}
                strokeWidth={2}
                cursor="pointer"
                onClick={() => {
                  const subset = itens.filter((l) => estado(l, hoje) === t);
                  onVerItens(subset, `Itens ${ROTULO_ESTADO[t]}`);
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <Legenda
          itens={legendaEstados}
          ativos={estadosAtivos}
          onClick={(c) => {
            const t = c as Tom;
            const subset = itens.filter((l) => estado(l, hoje) === t);
            onVerItens(subset, `Itens ${ROTULO_ESTADO[t]}`);
          }}
        />
      </ChartCard>

      <ChartCard
        col={8}
        titulo="Burn-up da carteira"
        pergunta="A equipe está entregando no ritmo em que a carteira cresce? A distância entre as linhas é o backlog."
        vazio={serie.semanas.length < 2 ? "Histórico ainda curto para uma série semanal." : null}
        nota="Criação vem da auditoria; entrega, do prazo realizado. Últimas 26 semanas."
        tabela={{
          colunas: [
            { chave: "semana", rotulo: "Semana" },
            { chave: "criados", rotulo: "Criados (acum.)", numerica: true },
            { chave: "entregues", rotulo: "Entregues (acum.)", numerica: true },
            { chave: "backlog", rotulo: "Backlog", numerica: true },
          ],
          linhas: serie.semanas.map((s) => ({
            semana: rotuloDiaMes(String(s.semana)),
            criados: num(Number(s.criados)),
            entregues: num(Number(s.entregues)),
            backlog: num(Number(s.criados) - Number(s.entregues)),
          })),
        }}
      >
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={serie.semanas} margin={MARGEM}>
            <CartesianGrid {...GRADE} />
            <XAxis dataKey="semana" tickFormatter={(v) => rotuloDiaMes(String(v))} {...EIXO} minTickGap={24} />
            <YAxis {...EIXO} width={38} allowDecimals={false} />
            <Tooltip
              content={tooltipRecharts(
                (v) => `${num(v)} itens`,
                (l) => `Semana de ${rotuloDiaMes(l)}`,
              )}
            />
            <Area
              type="monotone"
              dataKey="criados"
              name="Criados"
              stroke={TOM_GRAFICO.cinza}
              strokeWidth={2}
              fill={TOM_GRAFICO.cinza}
              fillOpacity={0.1}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="entregues"
              name="Entregues"
              stroke={TOM_GRAFICO.verde}
              strokeWidth={2}
              fill={TOM_GRAFICO.verde}
              fillOpacity={0.1}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <Legenda
          itens={[
            { chave: "criados", rotulo: "Criados (acumulado)", cor: TOM_GRAFICO.cinza },
            { chave: "entregues", rotulo: "Entregues (acumulado)", cor: TOM_GRAFICO.verde },
          ]}
        />
      </ChartCard>

      <ChartCard
        col={4}
        titulo="Aging dos atrasos"
        pergunta="Os atrasos são de dias ou de meses? Clique numa faixa para ver os itens."
        vazio={aging.every((a) => a.itens === 0) ? "Nenhum item em aberto com prazo vencido." : null}
        tabela={{
          colunas: [
            { chave: "faixa", rotulo: "Faixa" },
            { chave: "itens", rotulo: "Itens", numerica: true },
          ],
          linhas: aging.map((a) => ({ faixa: a.faixa, itens: num(a.itens) })),
        }}
      >
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={aging} margin={MARGEM}>
            <CartesianGrid {...GRADE} />
            <XAxis dataKey="faixa" {...EIXO} />
            <YAxis {...EIXO} width={30} allowDecimals={false} />
            <Tooltip cursor={{ fill: CHART.grade }} content={tooltipRecharts((v) => `${num(v)} itens`)} />
            <Bar
              dataKey="itens"
              name="Itens atrasados"
              fill={TOM_GRAFICO.vermelho}
              maxBarSize={BARRA_MAX}
              radius={RAIO_TOPO}
              cursor="pointer"
              onClick={(d: unknown) => {
                const faixa = (d as { payload?: { faixa?: string } })?.payload?.faixa;
                const f = FAIXAS_AGING.find((x) => x.rotulo === faixa);
                if (!f) return;
                const subset = itens.filter((l) => {
                  if (!emAberto(l)) return false;
                  const a = atrasoDias(l, hojeISO);
                  return a !== null && a >= f.min && a <= f.max;
                });
                onVerItens(subset, `Atrasados: ${f.rotulo}`, "Em aberto, pelo prazo vigente.");
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        col={6}
        titulo="Entregas por semana"
        pergunta="Qual é a vazão real da equipe, e ela está subindo ou caindo? Clique numa barra para ver as entregas."
        vazio={serie.semanas.length < 2 ? "Histórico ainda curto para uma série semanal." : null}
        nota="A linha é a média móvel de 4 semanas — mesma unidade das barras."
        tabela={{
          colunas: [
            { chave: "semana", rotulo: "Semana" },
            { chave: "entregas", rotulo: "Entregas", numerica: true },
            { chave: "media", rotulo: "Média 4 sem.", numerica: true },
          ],
          linhas: serie.semanas.map((s) => ({
            semana: rotuloDiaMes(String(s.semana)),
            entregas: num(Number(s.naSemana)),
            media: num(Number(s.media), 1),
          })),
        }}
      >
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={serie.semanas} margin={MARGEM}>
            <CartesianGrid {...GRADE} />
            <XAxis dataKey="semana" tickFormatter={(v) => rotuloDiaMes(String(v))} {...EIXO} minTickGap={24} />
            <YAxis {...EIXO} width={30} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: CHART.grade }}
              content={tooltipRecharts(
                (v, nome) => (nome === "Média 4 semanas" ? num(v, 1) : `${num(v)} itens`),
                (l) => `Semana de ${rotuloDiaMes(l)}`,
              )}
            />
            <Bar
              dataKey="naSemana"
              name="Entregas"
              fill={TOM_GRAFICO.verde}
              maxBarSize={BARRA_MAX}
              radius={RAIO_TOPO}
              cursor="pointer"
              onClick={(d: unknown) => {
                const semana = (d as { payload?: { semana?: string } })?.payload?.semana;
                if (!semana) return;
                const subset = itens.filter(
                  (l) => l.prazoRealizado && l.prazoRealizado <= hojeISO && semanaDe(l.prazoRealizado) === semana,
                );
                onVerItens(subset, `Entregues na semana de ${rotuloDiaMes(semana)}`);
              }}
            />
            <Line
              type="monotone"
              dataKey="media"
              name="Média 4 semanas"
              stroke={TOM_GRAFICO.azul}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <Legenda
          itens={[
            { chave: "n", rotulo: "Entregas na semana", cor: TOM_GRAFICO.verde },
            { chave: "m", rotulo: "Média de 4 semanas", cor: TOM_GRAFICO.azul },
          ]}
        />
      </ChartCard>

      <ChartCard
        col={6}
        titulo="Calendário de vencimentos"
        pergunta="Que dias vão concentrar entrega nas próximas semanas — e o que já venceu e continua em aberto? Clique num dia para ver os itens."
        vazio={!calendario || calendario.totalAberto === 0 ? "Nenhum item em aberto com prazo definido." : null}
        nota="Só itens em aberto, pelo prazo vigente (o reprogramado tem precedência)."
      >
        {calendario && (
          <>
            <div className="ind-heat">
              <table className="ind-heat__grade">
                <tbody>
                  {DIAS_SEMANA.map((rot, linha) => (
                    <tr key={rot}>
                      <td className="ind-heat__rot">{rot}</td>
                      {calendario.celulas.map((sem, col) => {
                        const c = sem[linha];
                        const rampa = c.passado ? RAMPA_ATRASO : RAMPA_TEAL;
                        const cor =
                          c.qtd === 0
                            ? "#f4fafb"
                            : passoRampa(rampa, Math.min(1, c.qtd / calendario.max));
                        const claro = c.qtd / calendario.max < 0.55;
                        return (
                          <td
                            key={col}
                            className="ind-heat__cel"
                            title={`${c.dia.split("-").reverse().join("/")} — ${c.qtd} ${
                              c.qtd === 1 ? "item" : "itens"
                            }${c.passado ? " (vencido, em aberto)" : ""}`}
                            style={{
                              background: cor,
                              color: claro ? CHART.texto : "#fff",
                              outline: c.hoje ? `2px solid ${CHART.textoForte}` : undefined,
                              cursor: c.qtd > 0 ? "pointer" : "default",
                            }}
                            onClick={
                              c.qtd === 0
                                ? undefined
                                : () => {
                                    const subset = itens.filter(
                                      (l) => emAberto(l) && prazoVigente(l) === c.dia,
                                    );
                                    onVerItens(
                                      subset,
                                      c.passado
                                        ? `Vencido em ${formatBR(c.dia)} (em aberto)`
                                        : `Vence em ${formatBR(c.dia)}`,
                                    );
                                  }
                            }
                          >
                            {c.qtd || ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Legenda
              itens={[
                { chave: "v", rotulo: "Vencido e em aberto", cor: RAMPA_ATRASO[4] },
                { chave: "f", rotulo: "A vencer", cor: RAMPA_TEAL[4] },
              ]}
            />
          </>
        )}
      </ChartCard>
    </>
  );
}
