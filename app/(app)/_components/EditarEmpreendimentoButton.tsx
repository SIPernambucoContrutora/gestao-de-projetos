"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FaseEmpreendimento, TipoEmpreendimento } from "@/db/schema";
import { updateEmpreendimento } from "@/lib/actions/empreendimentos";
import { FASES_EMPREENDIMENTO, TIPOS_EMPREENDIMENTO } from "./empreendimentoLabels";

type Form = { nome: string; tipo: TipoEmpreendimento | ""; fase: FaseEmpreendimento | "" };

export function EditarEmpreendimentoButton({
  id,
  nome,
  tipo,
  fase,
}: {
  id: string;
  nome: string;
  tipo: TipoEmpreendimento | null;
  fase: FaseEmpreendimento | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ nome, tipo: tipo ?? "", fase: fase ?? "" });

  function abrir() {
    setForm({ nome, tipo: tipo ?? "", fase: fase ?? "" });
    setErro(null);
    setAberto(true);
  }

  function fechar() {
    if (salvando) return;
    setAberto(false);
  }

  async function salvar() {
    if (!form.nome.trim()) return setErro("Informe o nome do empreendimento.");
    if (!form.tipo) return setErro("Selecione o tipo do empreendimento.");
    if (!form.fase) return setErro("Selecione a fase do empreendimento.");
    setSalvando(true);
    setErro(null);
    try {
      await updateEmpreendimento(id, { nome: form.nome, tipo: form.tipo, fase: form.fase });
      router.refresh();
      setSalvando(false);
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
      setSalvando(false);
    }
  }

  const set = (campo: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <>
      <button type="button" className="btn-soft" onClick={abrir}>
        Editar
      </button>

      {aberto && (
        <div>
          <div className="modal-overlay" onClick={fechar} />
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h2 className="modal-title">Editar empreendimento</h2>
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
                <span className="field__label">Tipo *</span>
                <select className="input" value={form.tipo} onChange={set("tipo")}>
                  <option value="">— Selecione —</option>
                  {TIPOS_EMPREENDIMENTO.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ marginTop: "12px" }}>
                <span className="field__label">Fase *</span>
                <select className="input" value={form.fase} onChange={set("fase")}>
                  <option value="">— Selecione —</option>
                  {FASES_EMPREENDIMENTO.map((f) => (
                    <option key={f.valor} value={f.valor}>
                      {f.rotulo}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="modal-foot">
              {erro && <span className="drawer-foot__erro">{erro}</span>}
              <button type="button" className="btn-soft" onClick={fechar} disabled={salvando}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
