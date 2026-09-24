"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { EmpreendimentoComProgresso } from "@/lib/actions/empreendimentos";
import { FASES_EMPREENDIMENTO, ROTULO_FASE, ROTULO_TIPO } from "./empreendimentoLabels";

type FaseOuCategorizar = EmpreendimentoComProgresso["fase"] | "categorizar";

export function EmpreendimentosView({ emps }: { emps: EmpreendimentoComProgresso[] }) {
  const [faseAtiva, setFaseAtiva] = useState<FaseOuCategorizar | null>(null);

  const quadrantes = useMemo(() => {
    const porFase = FASES_EMPREENDIMENTO.map((f) => ({
      valor: f.valor as FaseOuCategorizar,
      rotulo: f.rotulo,
      qtd: emps.filter((e) => !e.precisaCategorizar && e.fase === f.valor).length,
    }));
    const aCategorizar = emps.filter((e) => e.precisaCategorizar).length;
    return aCategorizar > 0
      ? [...porFase, { valor: "categorizar" as FaseOuCategorizar, rotulo: "A categorizar", qtd: aCategorizar }]
      : porFase;
  }, [emps]);

  if (faseAtiva === null) {
    return (
      <section className="fase-grid">
        {quadrantes.map((q) => (
          <button
            key={q.valor}
            type="button"
            className={`fase-card${q.valor === "categorizar" ? " fase-card--categorizar" : ""}`}
            onClick={() => setFaseAtiva(q.valor)}
            disabled={q.qtd === 0}
          >
            <span className="fase-card__count">{q.qtd}</span>
            <span className="fase-card__label">{q.rotulo}</span>
          </button>
        ))}
      </section>
    );
  }

  const filtrados =
    faseAtiva === "categorizar"
      ? emps.filter((e) => e.precisaCategorizar)
      : emps.filter((e) => !e.precisaCategorizar && e.fase === faseAtiva);

  const rotuloFaseAtiva =
    faseAtiva === "categorizar" ? "A categorizar" : ROTULO_FASE[faseAtiva as keyof typeof ROTULO_FASE];

  return (
    <div>
      <div className="emp-fase-head">
        <button type="button" className="btn-soft" onClick={() => setFaseAtiva(null)}>
          ← Fases
        </button>
        <span className="emp-fase-head__titulo">{rotuloFaseAtiva}</span>
        <span className="emp-fase-head__sub">
          {filtrados.length} {filtrados.length === 1 ? "empreendimento" : "empreendimentos"}
        </span>
      </div>

      <section className="emp-grid">
        {filtrados.map((e) => (
          <EmpreendimentoCard key={e.id} emp={e} />
        ))}
      </section>
    </div>
  );
}

function EmpreendimentoCard({ emp }: { emp: EmpreendimentoComProgresso }) {
  return (
    <Link href={`/empreendimentos/${emp.id}`} className="card-item">
      <div className="card-item__top">
        <div className="card-item__name">{emp.nome}</div>
      </div>
      <div className="card-item__badges">
        {emp.precisaCategorizar ? (
          <span className="badge badge--vermelho">
            <span className="badge__dot" />
            Falta categorizar
          </span>
        ) : (
          <>
            <span className="badge badge--azul">
              <span className="badge__dot" />
              {ROTULO_TIPO[emp.tipo!]}
            </span>
            <span className="badge badge--cinza">
              <span className="badge__dot" />
              {ROTULO_FASE[emp.fase!]}
            </span>
            {emp.fase === "aprovado" && !emp.dataAprovacao && (
              <span className="badge badge--vermelho">
                <span className="badge__dot" />
                Sem data de aprovação
              </span>
            )}
          </>
        )}
      </div>
      <div className="card-item__progress-row">
        <span>
          {emp.itensFinalizados}/{emp.totalItens} itens finalizados
        </span>
        <span className="card-item__pct">{emp.progresso}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${emp.progresso}%` }} />
      </div>

      <div className="card-item__badges">
        <span className="badge badge--ambar">
          <span className="badge__dot" />
          {emp.itensEmAndamento} em andamento
        </span>
        <span className={`badge badge--${emp.itensAtrasados > 0 ? "vermelho" : "cinza"}`}>
          <span className="badge__dot" />
          {emp.itensAtrasados} atrasados
        </span>
      </div>
    </Link>
  );
}
