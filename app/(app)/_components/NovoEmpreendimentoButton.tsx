"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEmpreendimento } from "@/lib/actions/empreendimentos";

export function NovoEmpreendimentoButton() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "" });

  function fechar() {
    if (salvando) return;
    setAberto(false);
    setErro(null);
    setForm({ nome: "" });
  }

  async function salvar() {
    if (!form.nome.trim()) {
      setErro("Informe o nome do empreendimento.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await createEmpreendimento({ nome: form.nome });
      router.refresh();
      setSalvando(false);
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar.");
      setSalvando(false);
    }
  }

  const set = (campo: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setAberto(true)}>
        Novo empreendimento
      </button>

      {aberto && (
        <div>
          <div className="modal-overlay" onClick={fechar} />
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h2 className="modal-title">Novo empreendimento</h2>
              <button type="button" className="drawer-close" onClick={fechar} aria-label="Fechar">
                ×
              </button>
            </div>

            <div className="modal-body">
              <label className="field">
                <span className="field__label">Nome *</span>
                <input
                  className="input"
                  value={form.nome}
                  onChange={set("nome")}
                  placeholder="Ex.: Aurora Prince"
                  autoFocus
                />
              </label>
            </div>

            <div className="modal-foot">
              {erro && <span className="drawer-foot__erro">{erro}</span>}
              <button type="button" className="btn-soft" onClick={fechar} disabled={salvando}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? "Criando…" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
