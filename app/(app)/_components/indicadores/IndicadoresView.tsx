"use client";

/* ------------------------------------------------------------------ *
 * Casca da tela de Indicadores: filtros, abas e o recorte único que
 * todos os gráficos enxergam.
 *
 * O estado dos filtros mora na URL, não em useState. É o que torna um
 * recorte compartilhável ("manda o link do atraso da Estrutura") e o que
 * faz o botão Voltar do navegador desfazer um filtro — sem nenhum
 * armazenamento do lado do servidor.
 * ------------------------------------------------------------------ */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Etapa, Projetista } from "@/db/schema";
import type { LinhaIndicador } from "@/lib/actions/analytics";
import type { UsuarioBasico } from "@/lib/actions/usuarios";
import type { Tom } from "@/lib/ui/status";
import { parseISO } from "@/lib/ui/status";
import { ORDEM_PILHA, TOM_GRAFICO } from "@/lib/ui/charts";
import type { Filtros, Periodo } from "@/lib/ui/indicadores";
import { FILTROS_VAZIOS, ROTULO_ESTADO, aplicarFiltros } from "@/lib/ui/indicadores";
import { ItemDrawer } from "../ItensBoard";
import { AbaDisciplinas } from "./AbaDisciplinas";
import { AbaEmpreendimentos } from "./AbaEmpreendimentos";
import { AbaProjetistas } from "./AbaProjetistas";
import { AbaVisaoGeral } from "./AbaVisaoGeral";
import { FiltrosBar } from "./FiltrosBar";
import type { Opcao } from "./FiltrosBar";
import { ItensDrilldown } from "./ItensDrilldown";

type AbaKey = "geral" | "disciplinas" | "projetistas" | "empreendimentos";

const ABAS: { key: AbaKey; label: string }[] = [
  { key: "geral", label: "Visão geral" },
  { key: "disciplinas", label: "Disciplinas" },
  { key: "projetistas", label: "Projetistas" },
  { key: "empreendimentos", label: "Empreendimentos" },
];

/* ------------------------------------------------------------------ *
 * Serialização dos filtros na querystring
 * ------------------------------------------------------------------ */

const CHAVES: Record<keyof Omit<Filtros, "periodo" | "apenasAbertos">, string> = {
  empreendimentos: "emp",
  tipos: "tipo",
  fases: "fase",
  disciplinas: "disc",
  categorias: "cat",
  etapas: "etapa",
  projetistas: "proj",
  prioridades: "prio",
  estados: "est",
};

function lerFiltros(sp: URLSearchParams): Filtros {
  const lista = (k: string) => {
    const v = sp.get(k);
    return v ? v.split(",").filter(Boolean) : [];
  };
  const periodo = sp.get("per");
  return {
    empreendimentos: lista(CHAVES.empreendimentos),
    tipos: lista(CHAVES.tipos),
    fases: lista(CHAVES.fases),
    disciplinas: lista(CHAVES.disciplinas),
    categorias: lista(CHAVES.categorias),
    etapas: lista(CHAVES.etapas),
    projetistas: lista(CHAVES.projetistas),
    prioridades: lista(CHAVES.prioridades),
    estados: lista(CHAVES.estados) as Tom[],
    periodo: (["30", "90", "180", "365", "tudo"] as const).includes(periodo as Periodo)
      ? (periodo as Periodo)
      : "tudo",
    apenasAbertos: sp.get("ab") === "1",
  };
}

function escreverFiltros(f: Filtros, aba: AbaKey): string {
  const p = new URLSearchParams();
  for (const [campo, chave] of Object.entries(CHAVES) as [keyof typeof CHAVES, string][]) {
    const v = f[campo];
    if (v.length > 0) p.set(chave, v.join(","));
  }
  if (f.periodo !== "tudo") p.set("per", f.periodo);
  if (f.apenasAbertos) p.set("ab", "1");
  if (aba !== "geral") p.set("aba", aba);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Opções ordenadas e sem repetição, extraídas dos próprios dados. */
function opcoesDe(
  itens: LinhaIndicador[],
  id: (l: LinhaIndicador) => string | null,
  nome: (l: LinhaIndicador) => string,
): Opcao[] {
  const m = new Map<string, string>();
  for (const l of itens) {
    const k = id(l);
    if (k !== null) m.set(k, nome(l));
  }
  return [...m.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

const ROTULO_TIPO: Record<string, string> = { prince: "Prince", praia: "Praia" };
const ROTULO_FASE: Record<string, string> = {
  em_estudo: "Em estudo",
  pre_lancamento: "Pré-lançamento",
  aprovado: "Aprovado",
  executado: "Executado",
};
const ROTULO_CATEGORIA: Record<string, string> = { obra: "Obra", lancamento: "Lançamento" };
const ROTULO_PRIORIDADE: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };

export function IndicadoresView({
  itens,
  hojeISO,
  etapas,
  projetistas,
  usuarios,
  podeEditar,
}: {
  itens: LinhaIndicador[];
  hojeISO: string;
  /** Só alimentam o drawer de edição do item (ver ItemDrawer em ItensBoard.tsx). */
  etapas: Etapa[];
  projetistas: Projetista[];
  usuarios: UsuarioBasico[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Painel de itens (drill-through) e o item aberto para edição dentro
  // dele. Ficam fora da URL de propósito: são um estado de navegação
  // passageiro, não um recorte que faça sentido compartilhar.
  //
  // Clicar num gráfico NUNCA muda o filtro geral — só abre o painel com o
  // subconjunto daquela marca específica (congelado no momento do
  // clique). Quem muda o filtro é só a barra de filtros, de propósito
  // (ver FiltrosBar). Dois modos:
  //   · "filtrados" — o recorte GLOBAL ao vivo, usado pelo botão "N de M
  //     itens" da barra de filtros (não é drill de gráfico nenhum).
  //   · "pontual" — o subconjunto de uma marca específica.
  type PainelState =
    | { modo: "filtrados"; titulo: string; subtitulo?: string }
    | { modo: "pontual"; titulo: string; subtitulo?: string; itens: LinhaIndicador[] };
  const [painel, setPainel] = useState<PainelState | null>(null);
  const [itemAberto, setItemAberto] = useState<LinhaIndicador | null>(null);

  const filtros = useMemo(() => lerFiltros(new URLSearchParams(sp.toString())), [sp]);
  const aba = (sp.get("aba") as AbaKey) ?? "geral";

  const navegar = useCallback(
    (f: Filtros, a: AbaKey) => {
      // replace (e não push): filtrar é ajustar a mesma tela, não navegar —
      // o Voltar precisa sair do painel, não desfazer clique a clique.
      router.replace(`${pathname}${escreverFiltros(f, a)}`, { scroll: false });
    },
    [pathname, router],
  );

  const set = useCallback(
    (patch: Partial<Filtros>) => navegar({ ...filtros, ...patch }, aba),
    [filtros, aba, navegar],
  );
  const limpar = useCallback(() => navegar(FILTROS_VAZIOS, aba), [aba, navegar]);

  const filtrados = useMemo(
    () => aplicarFiltros(itens, filtros, hojeISO),
    [itens, filtros, hojeISO],
  );

  // As opções saem do conjunto COMPLETO, não do filtrado: uma lista que
  // encolhe a cada clique impede desfazer o próprio filtro.
  const opcoes = useMemo(
    () => ({
      empreendimentos: opcoesDe(itens, (l) => l.empreendimentoId, (l) => l.empreendimentoNome),
      tipos: opcoesDe(
        itens,
        (l) => l.empreendimentoTipo,
        (l) => ROTULO_TIPO[l.empreendimentoTipo ?? ""] ?? "—",
      ),
      fases: opcoesDe(
        itens,
        (l) => l.empreendimentoFase,
        (l) => ROTULO_FASE[l.empreendimentoFase ?? ""] ?? "—",
      ),
      disciplinas: opcoesDe(itens, (l) => l.disciplinaId, (l) => l.disciplinaNome),
      categorias: opcoesDe(
        itens,
        (l) => l.disciplinaCategoria,
        (l) => ROTULO_CATEGORIA[l.disciplinaCategoria ?? ""] ?? "—",
      ),
      etapas: opcoesDe(itens, (l) => l.etapaId, (l) => l.etapaNome),
      projetistas: opcoesDe(itens, (l) => l.projetistaId, (l) => l.projetistaNome ?? "—"),
      prioridades: opcoesDe(itens, (l) => l.prioridade, (l) => ROTULO_PRIORIDADE[l.prioridade]),
      estados: ORDEM_PILHA.map((t) => ({
        id: t,
        nome: ROTULO_ESTADO[t],
        cor: TOM_GRAFICO[t],
      })),
    }),
    [itens],
  );

  // Único jeito de abrir o painel a partir de um gráfico: a aba computa o
  // subconjunto exato daquela marca (ela é quem sabe o que a marca
  // representa) e manda para cá. Nenhum clique em gráfico muda o filtro
  // geral — só a barra de filtros faz isso.
  const onVerItens = useCallback(
    (subset: LinhaIndicador[], titulo: string, subtitulo?: string) => {
      setPainel({ modo: "pontual", titulo, subtitulo, itens: subset });
    },
    [],
  );

  const dataHoje = parseISO(hojeISO);

  return (
    <div>
      <header className="page-head">
        <div className="page-head__row">
          <div>
            <h1 className="page-head__title">Indicadores</h1>
            <p className="page-head__sub">
              Prazo, vazão e retrabalho por disciplina, projetista e empreendimento
              {dataHoje && ` · posição de ${hojeISO.split("-").reverse().join("/")}`}
            </p>
          </div>
          {/* Volta para a tabela operacional — o par do botão "Indicadores"
              no Dashboard. */}
          <Link
            href="/"
            className="btn-soft"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none", flex: "none" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <polyline points="6.5,3.5 3,8 6.5,12.5" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            Voltar ao Dashboard
          </Link>
        </div>

        <FiltrosBar
          filtros={filtros}
          set={set}
          limpar={limpar}
          opcoes={opcoes}
          total={itens.length}
          mostrados={filtrados.length}
          onVerItens={() => setPainel({ modo: "filtrados", titulo: "Itens no recorte atual" })}
        />

        <div className="ind-abas">
          {ABAS.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`ind-aba${aba === a.key ? " ind-aba--on" : ""}`}
              onClick={() => navegar(filtros, a.key)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </header>

      <section className="ind-body">
        {filtrados.length === 0 ? (
          <div className="ind-card ind-col-12">
            <div className="ind-card__vazio">
              Nenhum item corresponde aos filtros. Limpe algum recorte para voltar a ver dados.
            </div>
          </div>
        ) : aba === "disciplinas" ? (
          <AbaDisciplinas
            itens={filtrados}
            hojeISO={hojeISO}
            disciplinasAtivas={filtros.disciplinas}
            onVerItens={onVerItens}
          />
        ) : aba === "projetistas" ? (
          <AbaProjetistas
            itens={filtrados}
            hojeISO={hojeISO}
            projetistasAtivos={filtros.projetistas}
            onVerItens={onVerItens}
          />
        ) : aba === "empreendimentos" ? (
          <AbaEmpreendimentos itens={filtrados} hojeISO={hojeISO} onVerItens={onVerItens} />
        ) : (
          <AbaVisaoGeral
            itens={filtrados}
            hojeISO={hojeISO}
            estadosAtivos={filtros.estados}
            onVerItens={onVerItens}
          />
        )}
      </section>

      {painel && (
        <ItensDrilldown
          itens={painel.modo === "filtrados" ? filtrados : painel.itens}
          titulo={painel.titulo}
          subtitulo={painel.subtitulo}
          hojeISO={hojeISO}
          onAbrirItem={(it) => setItemAberto(it)}
          onClose={() => setPainel(null)}
        />
      )}

      {itemAberto && (
        <ItemDrawer
          key={itemAberto.id}
          item={itemAberto}
          etapas={etapas}
          projetistas={projetistas}
          usuarios={usuarios}
          podeEditar={podeEditar}
          hoje={dataHoje ?? new Date()}
          onClose={() => setItemAberto(null)}
        />
      )}
    </div>
  );
}
