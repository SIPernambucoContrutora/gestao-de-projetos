"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Projetista } from "@/db/schema";
import { deleteProjetista } from "@/lib/actions/projetistas";
import { ProjetistaFormModal } from "./ProjetistaFormModal";

export function ProjetistasTable({
  projetistas,
  podeEditar,
}: {
  projetistas: Projetista[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<Projetista | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  async function excluir(p: Projetista) {
    if (!window.confirm(`Excluir o projetista "${p.nome}"? Esta ação não pode ser desfeita.`)) return;
    setExcluindoId(p.id);
    try {
      await deleteProjetista(p.id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>E-mail</th>
              {podeEditar && <th className="ta-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {projetistas.map((p) => (
              <tr key={p.id}>
                <td className="td-strong">{p.nome}</td>
                <td className="mono td-muted">{p.telefone ?? "—"}</td>
                <td className="td-muted">{p.email ?? "—"}</td>
                {podeEditar && (
                  <td className="ta-right">
                    <button type="button" className="btn-soft" onClick={() => setEditando(p)} style={{ marginRight: "8px" }}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-danger-soft"
                      onClick={() => excluir(p)}
                      disabled={excluindoId === p.id}
                    >
                      {excluindoId === p.id ? "Excluindo…" : "Excluir"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && <ProjetistaFormModal projetista={editando} onClose={() => setEditando(null)} />}
    </>
  );
}
