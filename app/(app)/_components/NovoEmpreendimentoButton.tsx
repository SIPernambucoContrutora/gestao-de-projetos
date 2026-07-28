"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEmpreendimento } from "@/lib/actions/empreendimentos";

export function NovoEmpreendimentoButton() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    responsavel: "",
    revisaoAtual: "R00",
    dataRevisao: "",
  });

  function fechar() {
    if (salvando) return;
    setAberto(false);
    setErro(null);
    setForm({ nome: "", responsavel: "", revisaoAtual: "R00", dataRevisao: "" });
  }

  async function salvar() {
    if (!form.nome.trim()) {
      setErro("Informe o nome do empreendimento.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await createEmpreendimento({
        nome: form.nome,
        responsavel: form.responsavel || null,
        revisaoAtual: form.revisaoAtual || "R00",
        dataRevisao: form.dataRevisao || null,
      });
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
              <label className="field" style={{ marginTop: "12px" }}>
                <span className="field__label">Responsável</span>
                <input
                  className="input"
                  value={form.responsavel}
                  onChange={set("responsavel")}
                  placeholder="Ex.: Marina Duarte"
                />
              </label>
              <div className="form-grid" style={{ marginTop: "12px" }}>
                <label className="field">
                  <span className="field__label">Revisão atual</span>
                  <input className="input mono" value={form.revisaoAtual} onChange={set("revisaoAtual")} />
                </label>
                <label className="field">
                  <span className="field__label">Data da revisão</span>
                  <input type="date" className="input mono" value={form.dataRevisao} onChange={set("dataRevisao")} />
                </label>
              </div>
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
