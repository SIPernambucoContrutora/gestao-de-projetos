"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Projetista } from "@/db/schema";
import { createProjetista, updateProjetista } from "@/lib/actions/projetistas";

type Form = { nome: string; telefone: string; email: string };

function toForm(p?: Projetista | null): Form {
  return { nome: p?.nome ?? "", telefone: p?.telefone ?? "", email: p?.email ?? "" };
}

export function ProjetistaFormModal({
  projetista,
  onClose,
}: {
  projetista?: Projetista | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(projetista));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const editando = !!projetista;

  async function salvar() {
    if (!form.nome.trim()) return setErro("Informe o nome do projetista.");
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        nome: form.nome,
        telefone: form.telefone || null,
        email: form.email || null,
      };
      if (editando) {
        await updateProjetista(projetista!.id, payload);
      } else {
        await createProjetista(payload);
      }
      router.refresh();
      setSalvando(false);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
      setSalvando(false);
    }
  }

  const set = (campo: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <div>
      <div className="modal-overlay" onClick={() => !salvando && onClose()} />
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2 className="modal-title">{editando ? "Editar projetista" : "Novo projetista"}</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span className="field__label">Nome do projetista *</span>
            <input className="input" value={form.nome} onChange={set("nome")} placeholder="Ex.: João Silva" autoFocus />
          </label>
          <div className="form-grid" style={{ marginTop: "12px" }}>
            <label className="field">
              <span className="field__label">Telefone</span>
              <input className="input mono" value={form.telefone} onChange={set("telefone")} placeholder="Ex.: (81) 99999-0000" />
            </label>
            <label className="field">
              <span className="field__label">E-mail</span>
              <input type="email" className="input" value={form.email} onChange={set("email")} placeholder="Ex.: joao@escritorio.com" />
            </label>
          </div>
        </div>

        <div className="modal-foot">
          {erro && <span className="drawer-foot__erro">{erro}</span>}
          <button type="button" className="btn-soft" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : editando ? "Salvar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
