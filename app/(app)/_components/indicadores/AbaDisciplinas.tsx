"use client";

/* ------------------------------------------------------------------ *
 * Disciplinas — qual especialidade trava, em que ponto do processo, e
 * quanto de retrabalho ela gera.
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LinhaIndicador } from "@/lib/actions/analytics";
import { parseISO } from "@/lib/ui/status";
import {
  CHART,
  ORDEM_PILHA,
  RAMPA_ATRASO,
  TOM_GRAFICO,
  curto,
  dias,
  num,
  passoRampa,
  pct,
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
  percentil,
  taxa,
} from "@/lib/ui/indicadores";
import {
  BARRA_MAX,
  ChartCard,
  EIXO,
  GRADE,
  Legenda,
  MARGEM,
  RAIO_DIREITA,
  tooltipRecharts,
} from "./Chrome";

const ROTULO_CATEGORIA: Record<string, string> = {
  obra: "Obra",
  lancamento: "Lançamento",
  "": "A categorizar",
};

/** Teto de linhas nos rankings: acima disso o eixo vira ilegível. */
const TETO = 12;

export function AbaDisciplinas({
  itens,
  hojeISO,
  disciplinasAtivas,
  onVerItens,
}: {
  itens: LinhaIndicador[];
  hojeISO: string;
  /** Vem da barra de filtros (manual) — só para destacar o que já está filtrado. */
  disciplinasAtivas: string[];
  /** Único jeito de ver os itens por trás de uma marca: abre o painel, nunca muda o filtro. */
  onVerItens: (itens: LinhaIndicador[], titulo: string, subtitulo?: string) => void;
}) {
  const hoje = useMemo(() => parseISO(hojeISO) ?? new Date(), [hojeISO]);

  /* ---------------- Ranking por taxa de atraso ---------------- */
  const ranking = useMemo(() => {
    const linhas = agrupar(
      itens,
      (l) => l.disciplinaId,
      (l) => l.disciplinaNome,
      (grupo, id, nome) => {
        const abertos = grupo.filter(emAberto);
        const atrasados = abertos.filter((l) => atrasoDias(l, hojeISO) !== null).length;
        return {
          id,
          nome,
          total: grupo.length,
          abertos: abertos.length,
          atrasados,
          // Sem itens em aberto não há taxa a medir — 0% mentiria.
          taxaAtraso: taxa(atrasados, abertos.length),
        };
      },
    );
    // Ordena pela TAXA, com o n visível ao lado: uma disciplina de 2 itens
    // não pode liderar um ranking só por ter 1 atrasado.
    return linhas
      .filter((l) => l.taxaAtraso !== null)
      .sort((a, b) => (b.taxaAtraso ?? 0) - (a.taxaAtraso ?? 0) || b.abertos - a.abertos)
      .slice(0, TETO);
  }, [itens, hojeISO]);

  /* ---------------- Matriz disciplina × etapa ---------------- */
  const matriz = useMemo(() => {
    const etapasMap = new Map<string, string>();
    const discMap = new Map<string, { nome: string; total: number }>();
    for (const l of itens) {
      etapasMap.set(l.etapaId, l.etapaNome);
      const d = discMap.get(l.disciplinaId);
      if (d) d.total++;
      else discMap.set(l.disciplinaId, { nome: l.disciplinaNome, total: 1 });
    }
    const etapasLista = [...etapasMap.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const discLista = [...discMap.entries()]
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, TETO);

    const celulas = discLista.map((d) =>
      etapasLista.map((e) => {
        const grupo = itens.filter((l) => l.disciplinaId === d.id && l.etapaId === e.id);
        const abertos = grupo.filter(emAberto);
        const atrasados = abertos.filter((l) => atrasoDias(l, hojeISO) !== null).length;
        return {
          disciplinaId: d.id,
          disciplinaNome: d.nome,
          etapaId: e.id,
          etapa: e.nome,
          qtd: grupo.length,
          taxaAtraso: taxa(atrasados, abertos.length),
        };
      }),
    );

    return { discLista, etapasLista, celulas };
  }, [itens, hojeISO]);

  /* ---------------- Obra × Lançamento ---------------- */
  const categorias = useMemo(() => {
    const chaves = ["obra", "lancamento", ""] as const;
    const linhas = chaves
      .map((c) => {
        const grupo = itens.filter((l) => (l.disciplinaCategoria ?? "") === c);
        if (grupo.length === 0) return null;
        const cont = contarEstados(grupo, hoje);
        const linha: Record<string, number | string> = {
          categoria: ROTULO_CATEGORIA[c],
          categoriaChave: c,
          total: grupo.length,
        };
        for (const t of ORDEM_PILHA) linha[t] = cont[t];
        return linha;
      })
      .filter((l): l is Record<string, number | string> => l !== null);
    return linhas;
  }, [itens, hoje]);

  /* ---------------- Lead time por disciplina ---------------- */
  const lead = useMemo(() => {
    const linhas = agrupar(
      itens,
      (l) => l.disciplinaId,
      (l) => l.disciplinaNome,
      (grupo, id, nome) => {
        const v = grupo.map(leadProjetista).filter((d): d is number => d !== null);
        if (v.length < 2) return null; // sem dois pontos não há faixa a mostrar
        const p25 = percentil(v, 0.25)!;
        const p75 = percentil(v, 0.75)!;
        return {
          id,
          nome,
          med: Math.round(mediana(v)!),
          faixa: [Math.round(p25), Math.round(p75)] as [number, number],
          n: v.length,
        };
      },
    ).filter((l): l is NonNullable<typeof l> => l !== null);
    return linhas.sort((a, b) => b.med - a.med).slice(0, TETO);
  }, [itens]);

  /* ---------------- Retrabalho ---------------- */
  const retrabalho = useMemo(() => {
    const linhas = agrupar(
      itens,
      (l) => l.disciplinaId,
      (l) => l.disciplinaNome,
      (grupo, id, nome) => {
        // Só itens que chegaram ao fim podem ter gerado revisão.
        const fechados = grupo.filter((l) => l.status === "finalizado" || !!l.prazoRealizado);
        const comRevisao = fechados.filter((l) => l.revisoes > 0 || l.revisoesAbertas > 0).length;
        const t = taxa(comRevisao, fechados.length);
        return t === null || fechados.length < 2
          ? null
          : { id, nome, taxaRetrabalho: t, comRevisao, fechados };
      },
    ).filter((l): l is NonNullable<typeof l> => l !== null);
    return linhas.sort((a, b) => b.taxaRetrabalho - a.taxaRetrabalho).slice(0, TETO);
  }, [itens]);

  const maxMatriz = Math.max(1, ...matriz.celulas.flat().map((c) => c.qtd));

  return (
    <>
      <ChartCard
        col={6}
        titulo="Disciplinas por taxa de atraso"
        pergunta="Qual especialidade está segurando a carteira? Clique na barra para ver os itens atrasados."
        vazio={ranking.length === 0 ? "Nenhuma disciplina com itens em aberto no recorte." : null}
        nota="Ordenado pela taxa, não pela contagem — a coluna de itens em aberto mostra o tamanho da amostra."
        tabela={{
          colunas: [
            { chave: "nome", rotulo: "Disciplina" },
            { chave: "abertos", rotulo: "Em aberto", numerica: true },
            { chave: "atrasados", rotulo: "Atrasados", numerica: true },
            { chave: "taxa", rotulo: "Taxa", numerica: true },
          ],
          linhas: ranking.map((r) => ({
            nome: r.nome,
            abertos: num(r.abertos),
            atrasados: num(r.atrasados),
            taxa: pct(r.taxaAtraso ?? 0, 1),
          })),
        }}
      >
        <ResponsiveContainer width="100%" height={Math.max(180, ranking.length * 30 + 30)}>
          <BarChart data={ranking} layout="vertical" margin={{ ...MARGEM, right: 54 }}>
            <CartesianGrid {...GRADE} horizontal={false} vertical />
            <XAxis type="number" domain={[0, 100]} unit="%" {...EIXO} />
            <YAxis
              type="category"
              dataKey="nome"
              tickFormatter={(v) => curto(String(v), 20)}
              width={130}
              {...EIXO}
            />
            <Tooltip
              cursor={{ fill: CHART.grade }}
              content={tooltipRecharts((v) => pct(v, 1))}
            />
            <Bar
              dataKey="taxaAtraso"
              name="Taxa de atraso"
              maxBarSize={BARRA_MAX}
              radius={RAIO_DIREITA}
              cursor="pointer"
              onClick={(d: unknown) => {
                const r = (d as { payload?: (typeof ranking)[number] })?.payload;
                if (!r) return;
                const subset = itens.filter(
                  (l) => l.disciplinaId === r.id && emAberto(l) && atrasoDias(l, hojeISO) !== null,
                );
                onVerItens(subset, `Atrasados — ${r.nome}`);
              }}
            >
              {ranking.map((r) => (
                <Cell
                  key={r.id}
                  fill={TOM_GRAFICO.vermelho}
                  fillOpacity={
                    disciplinasAtivas.length === 0 || disciplinasAtivas.includes(r.id) ? 1 : 0.35
                  }
                />
              ))}
              <LabelList
                dataKey="abertos"
                position="right"
                formatter={(v: unknown) => `n=${v}`}
                style={{ fill: CHART.texto, fontSize: 10.5 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        col={6}
        titulo="Disciplina × etapa"
        pergunta="Em que ponto do processo cada disciplina trava? O número é o volume; a cor, a proporção de atraso. Clique numa célula para ver os itens."
        vazio={matriz.discLista.length === 0 ? "Nenhum item no recorte atual." : null}
        nota="Célula cinza = sem itens. A cor só considera os itens em aberto da célula."
      >
        <div className="ind-heat">
          <table className="ind-heat__grade">
            <thead>
              <tr>
                <th />
                {matriz.etapasLista.map((e) => (
                  <th key={e.id}>{curto(e.nome, 12)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matriz.discLista.map((d, i) => (
                <tr key={d.id}>
                  <td className="ind-heat__rot">{curto(d.nome, 20)}</td>
                  {matriz.celulas[i].map((c, j) => {
                    const vazia = c.qtd === 0;
                    const intensidade = c.taxaAtraso === null ? 0 : c.taxaAtraso / 100;
                    const cor = vazia
                      ? "#f4fafb"
                      : c.taxaAtraso === null
                        ? "#e7f3f4"
                        : passoRampa(RAMPA_ATRASO, intensidade);
                    return (
                      <td
                        key={j}
                        className="ind-heat__cel"
                        style={{
                          background: cor,
                          color: intensidade > 0.55 ? "#fff" : CHART.texto,
                          minWidth: 42,
                          cursor: vazia ? "default" : "pointer",
                        }}
                        title={`${d.nome} · ${c.etapa}: ${c.qtd} ${c.qtd === 1 ? "item" : "itens"}${
                          c.taxaAtraso === null ? "" : ` · ${pct(c.taxaAtraso, 0)} em atraso`
                        }`}
                        onClick={
                          vazia
                            ? undefined
                            : () => {
                                const subset = itens.filter(
                                  (l) => l.disciplinaId === c.disciplinaId && l.etapaId === c.etapaId,
                                );
                                onVerItens(subset, `${c.disciplinaNome} · ${c.etapa}`);
                              }
                        }
                      >
                        {vazia ? "" : c.qtd}
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
            { chave: "0", rotulo: "Sem atraso", cor: RAMPA_ATRASO[0] },
            { chave: "1", rotulo: "Metade atrasada", cor: RAMPA_ATRASO[3] },
            { chave: "2", rotulo: "Tudo atrasado", cor: RAMPA_ATRASO[6] },
          ]}
        />
        <p className="ind-card__nota">Maior volume no recorte: {num(maxMatriz)} itens numa célula.</p>
      </ChartCard>

      <ChartCard
        col={6}
        titulo="Obra × Lançamento"
        pergunta="O pipeline de lançamento está sendo canibalizado pelo de obra? Clique num segmento para ver os itens."
        vazio={categorias.length === 0 ? "Nenhum item no recorte atual." : null}
        nota="'A categorizar' são disciplinas cadastradas antes do campo de categoria existir."
        tabela={{
          colunas: [
            { chave: "categoria", rotulo: "Categoria" },
            ...ORDEM_PILHA.map((t) => ({ chave: t, rotulo: ROTULO_ESTADO[t], numerica: true })),
          ],
          linhas: categorias.map((c) => {
            const l: Record<string, string> = { categoria: String(c.categoria) };
            for (const t of ORDEM_PILHA) l[t] = num(Number(c[t]));
            return l;
          }),
        }}
      >
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={categorias} margin={MARGEM}>
            <CartesianGrid {...GRADE} />
            <XAxis dataKey="categoria" {...EIXO} />
            <YAxis {...EIXO} width={34} allowDecimals={false} />
            <Tooltip cursor={{ fill: CHART.grade }} content={tooltipRecharts((v) => `${num(v)} itens`)} />
            {ORDEM_PILHA.map((t) => (
              <Bar
                key={t}
                dataKey={t}
                name={ROTULO_ESTADO[t]}
                stackId="c"
                fill={TOM_GRAFICO[t]}
                maxBarSize={72}
                stroke={CHART.superficie}
                strokeWidth={2}
                cursor="pointer"
                onClick={(d: unknown) => {
                  const p = (d as { payload?: { categoria?: string; categoriaChave?: string } })?.payload;
                  if (!p) return;
                  const subset = itens.filter(
                    (l) => (l.disciplinaCategoria ?? "") === p.categoriaChave && estado(l, hoje) === t,
                  );
                  onVerItens(subset, `${p.categoria} · ${ROTULO_ESTADO[t]}`);
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
        titulo="Tempo de entrega por disciplina"
        pergunta="Quanto tempo cada disciplina leva do início à entrega do projetista — e quanto isso varia? Clique na barra para ver os itens medidos."
        vazio={lead.length === 0 ? "Amostra insuficiente: é preciso ao menos 2 itens com entrega medida por disciplina." : null}
        nota="A barra é o intervalo entre o 1º e o 3º quartil; o número é a mediana. A média esconderia a cauda."
        tabela={{
          colunas: [
            { chave: "nome", rotulo: "Disciplina" },
            { chave: "med", rotulo: "Mediana", numerica: true },
            { chave: "faixa", rotulo: "P25–P75", numerica: true },
            { chave: "n", rotulo: "Amostra", numerica: true },
          ],
          linhas: lead.map((l) => ({
            nome: l.nome,
            med: dias(l.med),
            faixa: `${l.faixa[0]}–${l.faixa[1]}`,
            n: num(l.n),
          })),
        }}
      >
        <ResponsiveContainer width="100%" height={Math.max(180, lead.length * 30 + 30)}>
          <BarChart data={lead} layout="vertical" margin={{ ...MARGEM, right: 58 }}>
            <CartesianGrid {...GRADE} horizontal={false} vertical />
            <XAxis type="number" {...EIXO} unit="d" />
            <YAxis
              type="category"
              dataKey="nome"
              tickFormatter={(v) => curto(String(v), 20)}
              width={130}
              {...EIXO}
            />
            <Tooltip
              cursor={{ fill: CHART.grade }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof lead)[number];
                return (
                  <div className="ind-tip">
                    <div className="ind-tip__titulo">{p.nome}</div>
                    <div className="ind-tip__linha">
                      <span className="ind-tip__key" style={{ background: TOM_GRAFICO.azul }} />
                      <span className="ind-tip__valor">{dias(p.med)}</span>
                      <span className="ind-tip__nome">mediana</span>
                    </div>
                    <div className="ind-tip__linha">
                      <span className="ind-tip__key" style={{ background: CHART.eixo }} />
                      <span className="ind-tip__valor">
                        {p.faixa[0]}–{p.faixa[1]}d
                      </span>
                      <span className="ind-tip__nome">metade central</span>
                    </div>
                    <div className="ind-tip__linha">
                      <span className="ind-tip__nome">amostra de {p.n} itens</span>
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="faixa"
              name="P25–P75"
              fill={TOM_GRAFICO.azul}
              fillOpacity={0.3}
              maxBarSize={BARRA_MAX}
              radius={[4, 4, 4, 4]}
              cursor="pointer"
              onClick={(d: unknown) => {
                const p = (d as { payload?: (typeof lead)[number] })?.payload;
                if (!p) return;
                const subset = itens.filter(
                  (l) => l.disciplinaId === p.id && leadProjetista(l) !== null,
                );
                onVerItens(subset, `Tempo de entrega — ${p.nome}`, "Só itens com entrega já medida.");
              }}
            >
              <LabelList
                dataKey="med"
                position="right"
                formatter={(v: unknown) => `${v}d`}
                style={{ fill: CHART.textoForte, fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        col={12}
        titulo="Retrabalho por disciplina"
        pergunta="Qual especialidade volta mais para revisão depois de entregue? Clique na barra para ver os itens com revisão."
        vazio={
          retrabalho.length === 0
            ? "Amostra insuficiente: é preciso ao menos 2 itens já fechados por disciplina."
            : null
        }
        tabela={{
          colunas: [
            { chave: "nome", rotulo: "Disciplina" },
            { chave: "fechados", rotulo: "Itens fechados", numerica: true },
            { chave: "comRevisao", rotulo: "Com revisão", numerica: true },
            { chave: "taxa", rotulo: "Retrabalho", numerica: true },
          ],
          linhas: retrabalho.map((r) => ({
            nome: r.nome,
            fechados: num(r.fechados.length),
            comRevisao: num(r.comRevisao),
            taxa: pct(r.taxaRetrabalho, 1),
          })),
        }}
      >
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={retrabalho} margin={{ ...MARGEM, bottom: 18 }}>
            <CartesianGrid {...GRADE} />
            <XAxis
              dataKey="nome"
              tickFormatter={(v) => curto(String(v), 14)}
              {...EIXO}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={46}
            />
            <YAxis {...EIXO} width={38} unit="%" domain={[0, 100]} />
            <Tooltip cursor={{ fill: CHART.grade }} content={tooltipRecharts((v) => pct(v, 1))} />
            <Bar
              dataKey="taxaRetrabalho"
              name="Itens com revisão"
              fill={TOM_GRAFICO.rosa}
              maxBarSize={BARRA_MAX}
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(d: unknown) => {
                const r = (d as { payload?: (typeof retrabalho)[number] })?.payload;
                if (!r) return;
                const subset = itens.filter(
                  (l) =>
                    l.disciplinaId === r.id &&
                    (l.status === "finalizado" || !!l.prazoRealizado) &&
                    (l.revisoes > 0 || l.revisoesAbertas > 0),
                );
                onVerItens(subset, `Retrabalho — ${r.nome}`, "Itens fechados que geraram pelo menos uma revisão.");
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}
