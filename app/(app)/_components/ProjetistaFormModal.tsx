"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProjetista } from "@/lib/actions/projetistas";
import { formatTelefone } from "@/lib/ui/telefone";

type Form = { nome: string; telefone: string; email: string };

/** Cadastro de projetista. A edição acontece no drawer da tabela. */
export function ProjetistaFormModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>({ nome: "", telefone: "", email: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!form.nome.trim()) return setErro("Informe o nome do projetista.");
    setSalvando(true);
    setErro(null);
    try {
      await createProjetista({
        nome: form.nome,
        telefone: form.telefone || null,
        email: form.email || null,
      });
      router.refresh();
      setSalvando(false);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
      setSalvando(false);
    }
  }

  const set = (campo: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = campo === "telefone" ? formatTelefone(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [campo]: valor }));
  };

  return (
    <div>
      <div className="modal-overlay" onClick={() => !salvando && onClose()} />
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2 className="modal-title">Novo projetista</h2>
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
              <input className="input mono" value={form.telefone} onChange={set("telefone")} inputMode="tel" placeholder="Ex.: (81)99999-0000" />
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
            {salvando ? "Salvando…" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
