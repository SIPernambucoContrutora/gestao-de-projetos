"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoriaDisciplina, Disciplina } from "@/db/schema";
import { updateDisciplina } from "@/lib/actions/disciplinas";
import { DisciplinaFormModal } from "./DisciplinaFormModal";

const CATEGORIAS: { valor: CategoriaDisciplina; rotulo: string }[] = [
  { valor: "obra", rotulo: "Obra" },
  { valor: "lancamento", rotulo: "Lançamento" },
];

const ROTULO_CATEGORIA: Record<CategoriaDisciplina, string> = {
  obra: "Obra",
  lancamento: "Lançamento",
};

export function DisciplinasTable({
  disciplinas,
  podeEditar,
}: {
  disciplinas: Disciplina[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<Disciplina | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function mudarCategoria(id: string, categoria: CategoriaDisciplina) {
    setSalvandoId(id);
    setErro(null);
    try {
      await updateDisciplina(id, { categoria });
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao alterar categoria.");
    } finally {
      setSalvandoId(null);
    }
  }

  return (
    <>
      {erro && <div className="usuarios-erro">{erro}</div>}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th style={{ width: "200px" }}>Categoria</th>
            </tr>
          </thead>
          <tbody>
            {disciplinas.map((d) => (
              <tr
                key={d.id}
                className={podeEditar ? "row-item" : undefined}
                onClick={() => podeEditar && setEditando(d)}
              >
                <td className="td-strong">{d.nome}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {podeEditar ? (
                    <select
                      className="input"
                      value={d.categoria ?? ""}
                      disabled={salvandoId === d.id}
                      onChange={(e) =>
                        mudarCategoria(d.id, e.target.value as CategoriaDisciplina)
                      }
                      style={{ width: "100%" }}
                    >
                      <option value="" disabled>
                        — Sem categoria —
                      </option>
                      {CATEGORIAS.map((c) => (
                        <option key={c.valor} value={c.valor}>
                          {c.rotulo}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={d.categoria ? undefined : "td-muted"}>
                      {d.categoria ? ROTULO_CATEGORIA[d.categoria] : "— Sem categoria —"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <DisciplinaFormModal
          key={editando.id}
          disciplina={editando}
          onClose={() => setEditando(null)}
        />
      )}
    </>
  );
}
