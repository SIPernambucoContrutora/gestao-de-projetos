"use client";

/* ------------------------------------------------------------------ *
 * Projetistas — comparação entre eles.
 *
 * O drawer do menu de Projetistas já mostra o desempenho de UM projetista
 * por vez; o que faltava era pôr todos lado a lado. Aqui vale a ótica do
 * PROJETISTA: a entrega dele é a ida para análise, não o fechamento no
 * Autodoc (ver derivarStatusProjetista em lib/ui/status.ts).
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { LinhaIndicador } from "@/lib/actions/analytics";
import { parseISO } from "@/lib/ui/status";
import {
  CHART,
  ORDEM_PILHA,
  TOM_GRAFICO,
  corSerie,
  curto,
  dias,
  num,
  pct,
  rotuloMes,
} from "@/lib/ui/charts";
import {
  ROTULO_ESTADO,
  agrupar,
  atrasoDias,
  contarEstados,
  emAberto,
  estado,
  leadProjetista,
  mediana,
  mesDe,
  noPrazo,
  taxa,
} from "@/lib/ui/indicadores";
import {
  BARRA_MAX,
  ChartCard,
  EIXO,
  GRADE,
  Legenda,
  MARGEM,
  tooltipRecharts,
} from "./Chrome";

const TETO = 12;
/** Séries que se cruzam (dispersão, linhas convergentes) — teto de cores seguras. */
const TETO_LINHAS = 5;

type Score = {
  id: string;
  nome: string;
  total: number;
  abertos: number;
  atrasados: number;
  entregues: number;
  aderencia: number | null;
  leadMediano: number | null;
  reprogPorItem: number;
  primeira: number | null;
  revisoesPorItem: number;
};

export function AbaProjetistas({
  itens,
  hojeISO,
  projetistasAtivos,
  onVerItens,
}: {
  itens: LinhaIndicador[];
  hojeISO: string;
  /** Vem da barra de filtros (manual) — só para destacar o que já está filtrado. */
  projetistasAtivos: string[];
  /** Único jeito de ver os itens por trás de uma marca: abre o painel, nunca muda o filtro. */
  onVerItens: (itens: LinhaIndicador[], titulo: string, subtitulo?: string) => void;
}) {
  const hoje = useMemo(() => parseISO(hojeISO) ?? new Date(), [hojeISO]);

  /* ---------------- Scorecard ---------------- */
  const scores = useMemo<Score[]>(() => {
    const linhas = agrupar(
      itens,
      (l) => l.projetistaId,
      (l) => l.projetistaNome ?? "—",
      (grupo, id, nome): Score => {
        const abertos = grupo.filter(emAberto);
        const atrasados = abertos.filter((l) => atrasoDias(l, hojeISO) !== null).length;
        const medidos = grupo.filter((l) => noPrazo(l) !== null);
        const dentro = medidos.filter((l) => noPrazo(l) === true).length;
        const leads = grupo.map(leadProjetista).filter((d): d is number => d !== null);
        const analisados = grupo.filter((l) => l.entregaProjetista !== null);
        const semAjuste = analisados.filter((l) => !l.teveAjustes).length;
        const revisoes = grupo.reduce((s, l) => s + l.revisoes + l.revisoesAbertas, 0);

        return {
          id,
          nome,
          total: grupo.length,
          abertos: abertos.length,
          atrasados,
          entregues: medidos.length,
          aderencia: taxa(dentro, medidos.length),
          leadMediano: leads.length ? Math.round(mediana(leads)!) : null,
          reprogPorItem: grupo.length
            ? grupo.reduce((s, l) => s + l.reprogramacoes, 0) / grupo.length
            : 0,
          primeira: taxa(semAjuste, analisados.length),
          revisoesPorItem: grupo.length ? revisoes / grupo.length : 0,
        };
      },
    );
    // % no prazo primeiro (o que mais separa quem entrega bem de quem não
    // entrega), depois aprovação de primeira, depois volume de entregas.
    // Sem medição (null) afunda para o fim de cada critério — um projetista
    // sem nada para medir não pode disputar posição com um que tem número.
    const semDados = (v: number | null) => v ?? -1;
    return linhas.sort(
      (a, b) =>
        semDados(b.aderencia) - semDados(a.aderencia) ||
        semDados(b.primeira) - semDados(a.primeira) ||
        b.entregues - a.entregues,
    );
  }, [itens, hojeISO]);

  /* ---------------- Carga atual ---------------- */
  const carga = useMemo(() => {
    const linhas = agrupar(
      itens.filter(emAberto),
      (l) => l.projetistaId,
      (l) => l.projetistaNome ?? "—",
      (grupo, id, nome) => {
        const cont = contarEstados(grupo, hoje);
        const linha: Record<string, number | string> = { id, nome, total: grupo.length };
        for (const t of ORDEM_PILHA) linha[t] = cont[t];
        return linha;
      },
    );
    return linhas
      .sort((a, b) => Number(b.total) - Number(a.total))
      .slice(0, TETO);
  }, [itens, hoje]);

  /* ---------------- Confiabilidade × volume ---------------- */
  const dispersao = useMemo(
    () => scores.filter((s) => s.entregues >= 2 && s.aderencia !== null),
    [scores],
  );
  const aderenciaGeral = useMemo(() => {
    const medidos = itens.filter((l) => noPrazo(l) !== null);
    return taxa(medidos.filter((l) => noPrazo(l) === true).length, medidos.length);
  }, [itens]);

  /* ---------------- Reincidência ---------------- */
  const reincidencia = useMemo(
    () =>
      scores
        .filter((s) => s.total >= 2 && s.reprogPorItem > 0)
        .sort((a, b) => b.reprogPorItem - a.reprogPorItem)
        .slice(0, TETO),
    [scores],
  );

  /* ---------------- Lead time ao longo do tempo ---------------- */
  const evolucao = useMemo(() => {
    const top = scores
      .filter((s) => s.leadMediano !== null)
      .slice(0, TETO_LINHAS)
      .map((s) => ({ id: s.id, nome: s.nome }));
    if (top.length === 0) return { meses: [], top };

    const meses = new Set<string>();
    const porChave = new Map<string, number[]>();
    for (const l of itens) {
      const lead = leadProjetista(l);
      if (lead === null || !l.projetistaId || !l.entregaProjetista) continue;
      if (!top.some((t) => t.id === l.projetistaId)) continue;
      const m = mesDe(l.entregaProjetista);
      meses.add(m);
      const k = `${m}|${l.projetistaId}`;
      const arr = porChave.get(k);
      if (arr) arr.push(lead);
      else porChave.set(k, [lead]);
    }

    const ordenados = [...meses].sort().slice(-12);
    const linhas = ordenados.map((m) => {
      const linha: Record<string, number | string | null> = { mes: m };
      for (const t of top) {
        const v = porChave.get(`${m}|${t.id}`);
        linha[t.id] = v && v.length ? Math.round(mediana(v)!) : null;
      }
      return linha;
    });
    return { meses: linhas, top };
  }, [itens, scores]);

  return (
    <>
      <ChartCard
        col={12}
        titulo="Comparativo de projetistas"
        pergunta="Quem entrega no prazo, quem acumula atraso e quem gera retrabalho? Clique numa linha para ver os itens."
        vazio={scores.length === 0 ? "Nenhum item com projetista atribuído no recorte." : null}
        nota="Ordenado por % no prazo, depois aprovação de primeira, depois nº de entregas. Aderência e tempo de entrega usam a ótica do projetista: a entrega dele é a ida para análise."
      >
        <div className="ind-tab__wrap">
          <table className="ind-tab">
            <thead>
              <tr>
                <th>Projetista</th>
                <th className="ta-right">Em aberto</th>
                <th className="ta-right">Atrasados</th>
                <th className="ta-right">Entregas</th>
                <th className="ta-right">No prazo</th>
                <th>&nbsp;</th>
                <th className="ta-right">Tempo mediano</th>
                <th className="ta-right">Aprov. 1ª</th>
                <th className="ta-right">Reprog./item</th>
                <th className="ta-right">Revisões/item</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s) => {
                const ativo = projetistasAtivos.length === 0 || projetistasAtivos.includes(s.id);
                return (
                  <tr
                    key={s.id}
                    className="row-item"
                    style={{ opacity: ativo ? 1 : 0.45, cursor: "pointer" }}
                    onClick={() => {
                      const subset = itens.filter((l) => l.projetistaId === s.id);
                      onVerItens(subset, `Itens de ${s.nome}`);
                    }}
                  >
                    <td className="td-strong">{s.nome}</td>
                    <td className="ta-right">{num(s.abertos)}</td>
                    <td className="ta-right" style={{ color: s.atrasados > 0 ? TOM_GRAFICO.vermelho : undefined }}>
                      {num(s.atrasados)}
                    </td>
                    <td className="ta-right">{num(s.entregues)}</td>
                    <td className="ta-right">{s.aderencia === null ? "—" : pct(s.aderencia)}</td>
                    <td>
                      <div className="ind-mini-barra">
                        <div
                          className="ind-mini-barra__fill"
                          style={{
                            width: `${s.aderencia ?? 0}%`,
                            background:
                              (s.aderencia ?? 0) >= 70 ? TOM_GRAFICO.verde : TOM_GRAFICO.ambar,
                          }}
                        />
                      </div>
                    </td>
                    <td className="ta-right">{dias(s.leadMediano)}</td>
                    <td className="ta-right">{s.primeira === null ? "—" : pct(s.primeira)}</td>
                    <td className="ta-right">{num(s.reprogPorItem, 2)}</td>
                    <td className="ta-right">{num(s.revisoesPorItem, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <ChartCard
        col={6}
        titulo="Confiabilidade × volume"
        pergunta="Quem entrega muito e mal, e quem é bom mas está subutilizado? Clique num ponto para ver as entregas."
        vazio={dispersao.length === 0 ? "Amostra insuficiente: é preciso ao menos 2 entregas medidas por projetista." : null}
        nota="O tamanho do ponto é a carga em aberto hoje. A linha tracejada é a aderência média da carteira."
        tabela={{
          colunas: [
            { chave: "nome", rotulo: "Projetista" },
            { chave: "entregues", rotulo: "Entregas", numerica: true },
            { chave: "aderencia", rotulo: "No prazo", numerica: true },
            { chave: "abertos", rotulo: "Em aberto", numerica: true },
          ],
          linhas: dispersao.map((s) => ({
            nome: s.nome,
            entregues: num(s.entregues),
            aderencia: pct(s.aderencia ?? 0),
            abertos: num(s.abertos),
          })),
        }}
      >
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ ...MARGEM, bottom: 18, left: 4 }}>
            <CartesianGrid {...GRADE} vertical />
            <XAxis
              type="number"
              dataKey="entregues"
              name="Entregas"
              {...EIXO}
              label={{ value: "entregas medidas", position: "insideBottom", offset: -10, fill: CHART.texto, fontSize: 10.5 }}
            />
            <YAxis
              type="number"
              dataKey="aderencia"
              name="No prazo"
              domain={[0, 100]}
              unit="%"
              width={42}
              {...EIXO}
            />
            <ZAxis type="number" dataKey="abertos" range={[70, 520]} name="Em aberto" />
            {aderenciaGeral !== null && (
              <ReferenceLine
                y={aderenciaGeral}
                stroke={CHART.eixo}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: CHART.eixo }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Score;
                return (
                  <div className="ind-tip">
                    <div className="ind-tip__titulo">{p.nome}</div>
                    <div className="ind-tip__linha">
                      <span className="ind-tip__key" style={{ background: TOM_GRAFICO.azul }} />
                      <span className="ind-tip__valor">{pct(p.aderencia ?? 0)}</span>
                      <span className="ind-tip__nome">entregue no prazo</span>
                    </div>
                    <div className="ind-tip__linha">
                      <span className="ind-tip__valor">{num(p.entregues)}</span>
                      <span className="ind-tip__nome">entregas medidas</span>
                    </div>
                    <div className="ind-tip__linha">
                      <span className="ind-tip__valor">{num(p.abertos)}</span>
                      <span className="ind-tip__nome">itens em aberto</span>
                    </div>
                  </div>
                );
              }}
            />
            <Scatter
              data={dispersao}
              name="Projetistas"
              fill={TOM_GRAFICO.azul}
              fillOpacity={0.75}
              stroke={CHART.superficie}
              strokeWidth={2}
              cursor="pointer"
              onClick={(d: unknown) => {
                const p = d as Score | undefined;
                if (!p) return;
                const subset = itens.filter((l) => l.projetistaId === p.id && noPrazo(l) !== null);
                onVerItens(subset, `Entregas medidas — ${p.nome}`);
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        col={6}
        titulo="Carga atual"
        pergunta="O trabalho em aberto está equilibrado entre os projetistas? Clique num segmento para ver os itens."
        vazio={carga.length === 0 ? "Nenhum item em aberto no recorte." : null}
        tabela={{
          colunas: [
            { chave: "nome", rotulo: "Projetista" },
            ...ORDEM_PILHA.filter((t) => t !== "verde").map((t) => ({
              chave: t,
              rotulo: ROTULO_ESTADO[t],
              numerica: true,
            })),
          ],
          linhas: carga.map((c) => {
            const l: Record<string, string> = { nome: String(c.nome) };
            for (const t of ORDEM_PILHA) if (t !== "verde") l[t] = num(Number(c[t]));
            return l;
          }),
        }}
      >
        <ResponsiveContainer width="100%" height={Math.max(200, carga.length * 30 + 30)}>
          <BarChart data={carga} layout="vertical" margin={MARGEM}>
            <CartesianGrid {...GRADE} horizontal={false} vertical />
            <XAxis type="number" {...EIXO} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="nome"
              tickFormatter={(v) => curto(String(v), 18)}
              width={120}
              {...EIXO}
            />
            <Tooltip cursor={{ fill: CHART.grade }} content={tooltipRecharts((v) => `${num(v)} itens`)} />
            {/* Sem 'verde': a carga é o que está em aberto. Cada segmento é
                drill pontual (projetista + este estado específico) — não o
                cross-filter de projetista, que perderia qual cor foi clicada. */}
            {ORDEM_PILHA.filter((t) => t !== "verde").map((t) => (
              <Bar
                key={t}
                dataKey={t}
                name={ROTULO_ESTADO[t]}
                stackId="carga"
                fill={TOM_GRAFICO[t]}
                maxBarSize={BARRA_MAX}
                stroke={CHART.superficie}
                strokeWidth={2}
                cursor="pointer"
                onClick={(d: unknown) => {
                  const p = (d as { payload?: { id?: string; nome?: string } })?.payload;
                  if (!p?.id) return;
                  const subset = itens.filter(
                    (l) => l.projetistaId === p.id && emAberto(l) && estado(l, hoje) === t,
                  );
                  onVerItens(subset, `${p.nome} · ${ROTULO_ESTADO[t]}`);
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <Legenda
          itens={ORDEM_PILHA.filter((t) => t !== "verde").map((t) => ({
            chave: t,
            rotulo: ROTULO_ESTADO[t],
            cor: TOM_GRAFICO[t],
          }))}
        />
      </ChartCard>

      <ChartCard
        col={6}
        titulo="Reincidência de prazo"
        pergunta="Com quem o prazo é empurrado mais de uma vez? Clique na barra para ver os itens reprogramados."
        vazio={
          reincidencia.length === 0
            ? "Nenhuma reprogramação registrada no recorte (ou menos de 2 itens no projetista)."
            : null
        }
        nota="Conta cada prazo empurrado para frente na auditoria — não cada item atrasado."
        tabela={{
          colunas: [
            { chave: "nome", rotulo: "Projetista" },
            { chave: "itens", rotulo: "Itens", numerica: true },
            { chave: "reprog", rotulo: "Reprog./item", numerica: true },
          ],
          linhas: reincidencia.map((s) => ({
            nome: s.nome,
            itens: num(s.total),
            reprog: num(s.reprogPorItem, 2),
          })),
        }}
      >
        <ResponsiveContainer width="100%" height={Math.max(200, reincidencia.length * 30 + 30)}>
          <BarChart data={reincidencia} layout="vertical" margin={MARGEM}>
            <CartesianGrid {...GRADE} horizontal={false} vertical />
            <XAxis type="number" {...EIXO} />
            <YAxis
              type="category"
              dataKey="nome"
              tickFormatter={(v) => curto(String(v), 18)}
              width={120}
              {...EIXO}
            />
            <Tooltip cursor={{ fill: CHART.grade }} content={tooltipRecharts((v) => num(v, 2))} />
            <Bar
              dataKey="reprogPorItem"
              name="Reprogramações por item"
              fill={TOM_GRAFICO.rosa}
              maxBarSize={BARRA_MAX}
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(d: unknown) => {
                const p = (d as { payload?: { id?: string; nome?: string } })?.payload;
                if (!p?.id) return;
                // Ad-hoc: só os itens que de fato tiveram o prazo empurrado —
                // mais preciso que "todos os itens do projetista".
                const subset = itens.filter((l) => l.projetistaId === p.id && l.reprogramacoes > 0);
                onVerItens(subset, `Reincidência de prazo — ${p.nome}`, "Itens com pelo menos uma reprogramação.");
              }}
            >
              {reincidencia.map((s) => (
                <Cell
                  key={s.id}
                  fill={TOM_GRAFICO.rosa}
                  fillOpacity={
                    projetistasAtivos.length === 0 || projetistasAtivos.includes(s.id) ? 1 : 0.35
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        col={6}
        titulo="Tempo de entrega ao longo do tempo"
        pergunta="Quem está melhorando e quem está piorando? Clique num ponto para ver as entregas daquele mês."
        vazio={
          evolucao.meses.length < 2
            ? "Histórico de entregas ainda curto para uma série mensal."
            : null
        }
        nota={`Mediana mensal dos ${TETO_LINHAS} projetistas de maior volume. Meses sem entrega ficam vazios.`}
        tabela={{
          colunas: [
            { chave: "mes", rotulo: "Mês" },
            ...evolucao.top.map((t) => ({ chave: t.id, rotulo: t.nome, numerica: true })),
          ],
          linhas: evolucao.meses.map((m) => {
            const l: Record<string, string> = { mes: rotuloMes(String(m.mes)) };
            for (const t of evolucao.top) l[t.id] = m[t.id] === null ? "—" : dias(Number(m[t.id]));
            return l;
          }),
        }}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={evolucao.meses} margin={MARGEM}>
            <CartesianGrid {...GRADE} />
            <XAxis dataKey="mes" tickFormatter={(v) => rotuloMes(String(v))} {...EIXO} />
            <YAxis {...EIXO} width={38} unit="d" />
            <Tooltip
              content={tooltipRecharts(
                (v) => dias(v),
                (l) => rotuloMes(l),
              )}
            />
            {evolucao.top.map((t, i) => (
              <Line
                key={t.id}
                type="monotone"
                dataKey={t.id}
                name={t.nome}
                stroke={corSerie(i)}
                strokeWidth={2}
                connectNulls
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                dot={(props: any) => {
                  const { cx, cy, value, payload } = props;
                  if (value === null || value === undefined) return <g key={`${t.id}-${payload.mes}`} />;
                  const mes = String(payload.mes);
                  return (
                    <circle
                      key={`${t.id}-${mes}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={corSerie(i)}
                      stroke={CHART.superficie}
                      strokeWidth={2}
                      cursor="pointer"
                      onClick={() => {
                        const subset = itens.filter(
                          (l) =>
                            l.projetistaId === t.id &&
                            l.entregaProjetista &&
                            mesDe(l.entregaProjetista) === mes,
                        );
                        onVerItens(subset, `${t.nome} — entregas de ${rotuloMes(mes)}`);
                      }}
                    />
                  );
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <Legenda
          itens={evolucao.top.map((t, i) => ({ chave: t.id, rotulo: t.nome, cor: corSerie(i) }))}
          ativos={projetistasAtivos}
          onClick={(id) => {
            const t = evolucao.top.find((x) => x.id === id);
            if (!t) return;
            const subset = itens.filter((l) => l.projetistaId === id && leadProjetista(l) !== null);
            onVerItens(subset, `Tempo de entrega — ${t.nome}`, "Só itens com entrega já medida.");
          }}
        />
      </ChartCard>
    </>
  );
}
