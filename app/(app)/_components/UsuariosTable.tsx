"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PapelUsuario } from "@/db/schema";
import type { UsuarioListado } from "@/lib/actions/usuarios";
import { setPapelUsuario } from "@/lib/actions/usuarios";

const PAPEIS: { valor: PapelUsuario; rotulo: string }[] = [
  { valor: "admin", rotulo: "Admin" },
  { valor: "equipe", rotulo: "Equipe" },
  { valor: "leitura", rotulo: "Leitura" },
];

export function UsuariosTable({
  usuarios,
  currentUserId,
}: {
  usuarios: UsuarioListado[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function mudarPapel(usuarioId: string, papel: PapelUsuario) {
    setSalvandoId(usuarioId);
    setErro(null);
    try {
      await setPapelUsuario(usuarioId, papel);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao alterar papel.");
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
              <th>E-mail</th>
              <th style={{ width: "180px" }}>Papel</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="td-strong">
                  {u.name || "—"}
                  {u.id === currentUserId && <span className="tag-voce">você</span>}
                </td>
                <td className="td-muted">{u.email ?? "—"}</td>
                <td>
                  <select
                    className="input"
                    value={u.papel}
                    disabled={salvandoId === u.id}
                    onChange={(e) => mudarPapel(u.id, e.target.value as PapelUsuario)}
                    style={{ width: "100%" }}
                  >
                    {PAPEIS.map((p) => (
                      <option key={p.valor} value={p.valor}>
                        {p.rotulo}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
