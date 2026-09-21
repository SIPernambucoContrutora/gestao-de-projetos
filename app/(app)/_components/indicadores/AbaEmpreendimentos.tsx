"use client";

/* ------------------------------------------------------------------ *
 * Empreendimentos — o portfólio: quem anda, quem trava e onde o
 * cadastro tem buraco.
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { CHART, ORDEM_PILHA, RAMPA_ATRASO, TOM_GRAFICO, corSerie, curto, num, pct } from "@/lib/ui/charts";
import {
  ROTULO_ESTADO,
  agrupar,
  atrasoDias,
  contarEstados,
  emAberto,
  estado,
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

const ROTULO_FASE: Record<string, string> = {
  em_estudo: "Em estudo",
  pre_lancamento: "Pré-lançamento",
  aprovado: "Aprovado",
  executado: "Executado",
  "": "A categorizar",
};
const ORDEM_FASE = ["em_estudo", "pre_lancamento", "aprovado", "executado", ""];

const ROTULO_TIPO: Record<string, string> = {
  prince: "Prince",
  praia: "Praia",
  "": "A categorizar",
};
const ORDEM_TIPO = ["prince", "praia", ""];

const TETO = 14;

export function AbaEmpreendimentos({
  itens,
  hojeISO,
  onVerItens,
}: {
  itens: LinhaIndicador[];
  hojeISO: string;
  /** Único jeito de ver os itens por trás de uma marca: abre o painel, nunca muda o filtro. */
  onVerItens: (itens: LinhaIndicador[], titulo: string, subtitulo?: string) => void;
}) {
  const hoje = useMemo(() => parseISO(hojeISO) ?? new Date(), [hojeISO]);

  /* ---------------- Progresso comparado ---------------- */
  const progresso = useMemo(() => {
    const linhas = agrupar(
      itens,
      (l) => l.empreendimentoId,
      (l) => l.empreendimentoNome,
      (grupo, id, nome) => {
        const cont = contarEstados(grupo, hoje);
        const linha: Record<string, number | string> = {
          id,
          nome,
          total: grupo.length,
          conclusao: taxa(cont.verde, grupo.length) ?? 0,
        };
        for (const t of ORDEM_PILHA) linha[t] = cont[t];
        return linha;
      },
    );
    return linhas
      .sort((a, b) => Number(b.conclusao) - Number(a.conclusao))
      .slice(0, TETO);
  }, [itens, hoje]);

  /* ---------------- Portfólio: fase × tipo ---------------- */
  const portfolio = useMemo(() => {
    // Um empreendimento conta UMA vez, não uma por item.
    const emps = new Map<string, { fase: string; tipo: string }>();
    for (const l of itens) {
      emps.set(l.empreendimentoId, {
        fase: l.empreendimentoFase ?? "",
        tipo: l.empreendimentoTipo ?? "",
      });
    }
    const lista = [...emps.values()];
    const usados = ORDEM_TIPO.filter((t) => lista.some((e) => e.tipo === t));
    const dados = ORDEM_FASE.filter((f) => lista.some((e) => e.fase === f)).map((f) => {
      const linha: Record<string, number | string> = { fase: ROTULO_FASE[f], faseChave: f };
      for (const t of usados) {
        linha[t] = lista.filter((e) => e.fase === f && e.tipo === t).length;
      }
      return linha;
    });
    return { dados, tipos: usados, totalEmp: lista.length };
  }, [itens]);

  /* ---------------- Risco de cronograma ---------------- */
  const risco = useMemo(
    () =>
      agrupar(
        itens,
        (l) => l.empreendimentoId,
        (l) => l.empreendimentoNome,
        (grupo, id, nome) => {
          const cont = contarEstados(grupo, hoje);
          const abertos = grupo.filter(emAberto);
          const atrasados = abertos.filter((l) => atrasoDias(l, hojeISO) !== null).length;
          return {
            id,
            nome,
            fase: ROTULO_FASE[grupo[0].empreendimentoFase ?? ""],
            total: grupo.length,
            conclusao: taxa(cont.verde, grupo.length) ?? 0,
            atraso: taxa(atrasados, abertos.length),
            atrasados,
            abertos: abertos.length,
          };
        },
      ).filter((e) => e.atraso !== null),
    [itens, hoje, hojeISO],
  );

  /* ---------------- Cobertura empreendimento × disciplina ---------------- */
  const cobertura = useMemo(() => {
    const empMap = new Map<string, { nome: string; total: number }>();
    const discMap = new Map<string, { nome: string; total: number }>();
    for (const l of itens) {
      const e = empMap.get(l.empreendimentoId);
      if (e) e.total++;
      else empMap.set(l.empreendimentoId, { nome: l.empreendimentoNome, total: 1 });
      const d = discMap.get(l.disciplinaId);
      if (d) d.total++;
      else discMap.set(l.disciplinaId, { nome: l.disciplinaNome, total: 1 });
    }
    const emps = [...empMap.entries()]
      .map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => b.total - a.total)
      .slice(0, TETO);
    const discs = [...discMap.entries()]
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 14);

    const celulas = emps.map((e) =>
      discs.map((d) => {
        const grupo = itens.filter((l) => l.empreendimentoId === e.id && l.disciplinaId === d.id);
        const abertos = grupo.filter(emAberto);
        const atrasados = abertos.filter((l) => atrasoDias(l, hojeISO) !== null).length;
        return {
          empreendimentoId: e.id,
          empreendimentoNome: e.nome,
          disciplinaId: d.id,
          disc: d.nome,
          qtd: grupo.length,
          taxaAtraso: taxa(atrasados, abertos.length),
        };
      }),
    );
    return { emps, discs, celulas };
  }, [itens, hojeISO]);

  const conclusaoGeral = useMemo(() => {
    const cont = contarEstados(itens, hoje);
    return taxa(cont.verde, itens.length) ?? 0;
  }, [itens, hoje]);

  return (
    <>
      <ChartCard
        col={12}
        titulo="Progresso por empreendimento"
        pergunta="Quais empreendimentos andam e quais estão travados? Clique num segmento para ver os itens."
        vazio={progresso.length === 0 ? "Nenhum item no recorte atual." : null}
        tabela={{
          colunas: [
            { chave: "nome", rotulo: "Empreendimento" },
            { chave: "total", rotulo: "Itens", numerica: true },
            { chave: "conclusao", rotulo: "Conclusão", numerica: true },
            ...ORDEM_PILHA.map((t) => ({ chave: t, rotulo: ROTULO_ESTADO[t], numerica: true })),
          ],
          linhas: progresso.map((p) => {
            const l: Record<string, string> = {
              nome: String(p.nome),
              total: num(Number(p.total)),
              conclusao: pct(Number(p.conclusao)),
            };
            for (const t of ORDEM_PILHA) l[t] = num(Number(p[t]));
            return l;
          }),
        }}
      >
        <ResponsiveContainer width="100%" height={Math.max(200, progresso.length * 32 + 30)}>
          <BarChart data={progresso} layout="vertical" margin={MARGEM}>
            <CartesianGrid {...GRADE} horizontal={false} vertical />
            <XAxis type="number" {...EIXO} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="nome"
              tickFormatter={(v) => curto(String(v), 24)}
              width={170}
              {...EIXO}
            />
            <Tooltip cursor={{ fill: CHART.grade }} content={tooltipRecharts((v) => `${num(v)} itens`)} />
            {ORDEM_PILHA.map((t) => (
              <Bar
                key={t}
                dataKey={t}
                name={ROTULO_ESTADO[t]}
                stackId="p"
                fill={TOM_GRAFICO[t]}
                maxBarSize={BARRA_MAX}
                stroke={CHART.superficie}
                strokeWidth={2}
                cursor="pointer"
                onClick={(d: unknown) => {
                  const p = (d as { payload?: { id?: string; nome?: string } })?.payload;
                  if (!p?.id) return;
                  const subset = itens.filter(
                    (l) => l.empreendimentoId === p.id && estado(l, hoje) === t,
                  );
                  onVerItens(subset, `${p.nome} · ${ROTULO_ESTADO[t]}`);
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <Legenda
          itens={ORDEM_PILHA.map((t) => ({ chave: t, rotulo: ROTULO_ESTADO[t], cor: TOM_GRAFICO[t] }))}
        />
      </ChartCard>

      <ChartCard
        col={6}
        titulo="Portfólio por fase"
        pergunta="Quantos empreendimentos há em cada fase, e de que tipo? Clique num segmento para ver os itens."
        vazio={portfolio.dados.length === 0 ? "Nenhum empreendimento no recorte." : null}
        nota={`${portfolio.totalEmp} empreendimentos no recorte. Conta empreendimentos, não itens.`}
        tabela={{
          colunas: [
            { chave: "fase", rotulo: "Fase" },
            ...portfolio.tipos.map((t) => ({ chave: t, rotulo: ROTULO_TIPO[t], numerica: true })),
          ],
          linhas: portfolio.dados.map((d) => {
            const l: Record<string, string> = { fase: String(d.fase) };
            for (const t of portfolio.tipos) l[t] = num(Number(d[t]));
            return l;
          }),
        }}
      >
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={portfolio.dados} margin={MARGEM}>
            <CartesianGrid {...GRADE} />
            <XAxis dataKey="fase" {...EIXO} />
            <YAxis {...EIXO} width={30} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: CHART.grade }}
              content={tooltipRecharts((v) => `${num(v)} ${v === 1 ? "empreend." : "empreend."}`)}
            />
            {portfolio.tipos.map((t, i) => (
              <Bar
                key={t}
                dataKey={t}
                name={ROTULO_TIPO[t]}
                stackId="f"
                fill={t === "" ? TOM_GRAFICO.cinza : corSerie(i)}
                maxBarSize={56}
                stroke={CHART.superficie}
                strokeWidth={2}
                cursor="pointer"
                onClick={(d: unknown) => {
                  const p = (d as { payload?: { fase?: string; faseChave?: string } })?.payload;
                  if (!p) return;
                  const subset = itens.filter(
                    (l) =>
                      (l.empreendimentoFase ?? "") === p.faseChave &&
                      (l.empreendimentoTipo ?? "") === t,
                  );
                  onVerItens(subset, `${ROTULO_TIPO[t]} · ${p.fase}`);
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <Legenda
          itens={portfolio.tipos.map((t, i) => ({
            chave: t,
            rotulo: ROTULO_TIPO[t],
            cor: t === "" ? TOM_GRAFICO.cinza : corSerie(i),
          }))}
        />
      </ChartCard>

      <ChartCard
        col={6}
        titulo="Risco de cronograma"
        pergunta="Quais empreendimentos estão pouco avançados E muito atrasados? Clique num ponto para ver os itens atrasados."
        vazio={risco.length === 0 ? "Nenhum empreendimento com itens em aberto no recorte." : null}
        nota="Canto superior esquerdo = risco alto: pouca coisa pronta e muita coisa vencida. O ponto cresce com o nº de itens."
        tabela={{
          colunas: [
            { chave: "nome", rotulo: "Empreendimento" },
            { chave: "fase", rotulo: "Fase" },
            { chave: "conclusao", rotulo: "Conclusão", numerica: true },
            { chave: "atraso", rotulo: "Em atraso", numerica: true },
            { chave: "total", rotulo: "Itens", numerica: true },
          ],
          linhas: risco.map((r) => ({
            nome: r.nome,
            fase: r.fase,
            conclusao: pct(r.conclusao),
            atraso: pct(r.atraso ?? 0),
            total: num(r.total),
          })),
        }}
      >
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ ...MARGEM, bottom: 18, left: 4 }}>
            <CartesianGrid {...GRADE} vertical />
            <XAxis
              type="number"
              dataKey="conclusao"
              name="Conclusão"
              domain={[0, 100]}
              unit="%"
              {...EIXO}
              label={{
                value: "% concluído",
                position: "insideBottom",
                offset: -10,
                fill: CHART.texto,
                fontSize: 10.5,
              }}
            />
            <YAxis
              type="number"
              dataKey="atraso"
              name="Em atraso"
              domain={[0, 100]}
              unit="%"
              width={42}
              {...EIXO}
            />
            <ZAxis type="number" dataKey="total" range={[70, 520]} name="Itens" />
            <ReferenceLine y={50} stroke={CHART.eixo} strokeDasharray="4 4" />
            <ReferenceLine x={50} stroke={CHART.eixo} strokeDasharray="4 4" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: CHART.eixo }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof risco)[number];
                return (
                  <div className="ind-tip">
                    <div className="ind-tip__titulo">{p.nome}</div>
                    <div className="ind-tip__linha">
                      <span className="ind-tip__key" style={{ background: TOM_GRAFICO.vermelho }} />
                      <span className="ind-tip__valor">{pct(p.atraso ?? 0)}</span>
                      <span className="ind-tip__nome">dos abertos em atraso</span>
                    </div>
                    <div className="ind-tip__linha">
                      <span className="ind-tip__key" style={{ background: TOM_GRAFICO.verde }} />
                      <span className="ind-tip__valor">{pct(p.conclusao)}</span>
                      <span className="ind-tip__nome">concluído</span>
                    </div>
                    <div className="ind-tip__linha">
                      <span className="ind-tip__valor">{num(p.total)}</span>
                      <span className="ind-tip__nome">itens · {p.fase}</span>
                    </div>
                  </div>
                );
              }}
            />
            <Scatter
              data={risco}
              name="Empreendimentos"
              fill={TOM_GRAFICO.vermelho}
              fillOpacity={0.7}
              stroke={CHART.superficie}
              strokeWidth={2}
              cursor="pointer"
              onClick={(d: unknown) => {
                const p = d as (typeof risco)[number] | undefined;
                if (!p) return;
                const subset = itens.filter(
                  (l) => l.empreendimentoId === p.id && emAberto(l) && atrasoDias(l, hojeISO) !== null,
                );
                onVerItens(subset, `Atrasados — ${p.nome}`);
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        col={12}
        titulo="Cobertura de disciplinas"
        pergunta="Algum empreendimento está sem itens de uma disciplina que deveria ter? Clique numa célula para ver os itens."
        vazio={cobertura.emps.length === 0 ? "Nenhum item no recorte atual." : null}
        nota="Célula vazia = nenhum item cadastrado naquele cruzamento. Num empreendimento aprovado, isso costuma ser esquecimento de cadastro, não ausência de escopo."
      >
        <div className="ind-heat">
          <table className="ind-heat__grade">
            <thead>
              <tr>
                <th />
                {cobertura.discs.map((d) => (
                  <th key={d.id}>{curto(d.nome, 11)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cobertura.emps.map((e, i) => (
                <tr key={e.id}>
                  <td className="ind-heat__rot">{curto(e.nome, 24)}</td>
                  {cobertura.celulas[i].map((c, j) => {
                    const vazia = c.qtd === 0;
                    const t = c.taxaAtraso;
                    const cor = vazia
                      ? "#f4fafb"
                      : t === null
                        ? TOM_GRAFICO.verde
                        : t === 0
                          ? TOM_GRAFICO.verde
                          : t < 50
                            ? RAMPA_ATRASO[3]
                            : TOM_GRAFICO.vermelho;
                    return (
                      <td
                        key={j}
                        className="ind-heat__cel"
                        style={{
                          background: cor,
                          color: vazia ? CHART.texto : "#fff",
                          minWidth: 38,
                          cursor: vazia ? "default" : "pointer",
                        }}
                        title={`${e.nome} · ${c.disc}: ${
                          vazia
                            ? "sem itens cadastrados"
                            : `${c.qtd} ${c.qtd === 1 ? "item" : "itens"}${
                                t === null ? " (todos fechados)" : ` · ${pct(t, 0)} em atraso`
                              }`
                        }`}
                        onClick={
                          vazia
                            ? undefined
                            : () => {
                                const subset = itens.filter(
                                  (l) =>
                                    l.empreendimentoId === c.empreendimentoId &&
                                    l.disciplinaId === c.disciplinaId,
                                );
                                onVerItens(subset, `${c.empreendimentoNome} · ${c.disc}`);
                              }
                        }
                      >
                        {vazia ? "·" : c.qtd}
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
            { chave: "v", rotulo: "Sem itens", cor: "#f4fafb" },
            { chave: "ok", rotulo: "Sem atraso", cor: TOM_GRAFICO.verde },
            { chave: "p", rotulo: "Atraso parcial", cor: RAMPA_ATRASO[3] },
            { chave: "t", rotulo: "Tudo atrasado", cor: TOM_GRAFICO.vermelho },
          ]}
        />
        <p className="ind-card__nota">
          Conclusão média da carteira no recorte: {pct(conclusaoGeral)}. Empreendimentos e disciplinas
          ordenados por volume; a matriz mostra os maiores.
        </p>
      </ChartCard>
    </>
  );
}
