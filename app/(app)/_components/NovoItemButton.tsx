"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Disciplina, Etapa, StatusItem } from "@/db/schema";
import { createItem } from "@/lib/actions/itens";
import { ROTULO_STATUS } from "@/lib/ui/status";

const VAZIO = {
  item: "",
  disciplinaId: "",
  etapaId: "",
  planta: "",
  status: "pendente" as StatusItem,
  dataInicio: "",
  prazoPrevisto: "",
  prazoReprogramado: "",
  prazoRealizado: "",
  metaDias: "",
  observacoes: "",
};

export function NovoItemButton({
  empreendimentoId,
  disciplinas,
  etapas,
}: {
  empreendimentoId: string;
  disciplinas: Disciplina[];
  etapas: Etapa[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({ ...VAZIO });

  function fechar() {
    if (salvando) return;
    setAberto(false);
    setErro(null);
    setForm({ ...VAZIO });
  }

  async function salvar() {
    if (!form.disciplinaId) return setErro("Selecione a disciplina.");
    if (!form.etapaId) return setErro("Selecione a etapa.");
    setSalvando(true);
    setErro(null);
    try {
      await createItem({
        empreendimentoId,
        item: form.item.trim() ? Number(form.item) : null,
        disciplinaId: form.disciplinaId,
        etapaId: form.etapaId,
        planta: form.planta || null,
        status: form.status,
        dataInicio: form.dataInicio || null,
        prazoPrevisto: form.prazoPrevisto || null,
        prazoReprogramado: form.prazoReprogramado || null,
        prazoRealizado: form.prazoRealizado || null,
        metaDias: form.metaDias || null,
        observacoes: form.observacoes || null,
      });
      router.refresh();
      setSalvando(false);
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar.");
      setSalvando(false);
    }
  }

  const set =
    (campo: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setAberto(true)}>
        Novo item
      </button>

      {aberto && (
        <div>
          <div className="modal-overlay" onClick={fechar} />
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h2 className="modal-title">Novo item de projeto</h2>
              <button type="button" className="drawer-close" onClick={fechar} aria-label="Fechar">
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <label className="field">
                  <span className="field__label">Disciplina *</span>
                  <select className="input" value={form.disciplinaId} onChange={set("disciplinaId")} autoFocus>
                    <option value="">Selecione…</option>
                    {disciplinas.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Etapa *</span>
                  <select className="input" value={form.etapaId} onChange={set("etapaId")}>
                    <option value="">Selecione…</option>
                    {etapas.map((et) => (
                      <option key={et.id} value={et.id}>
                        {et.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Nº do item</span>
                  <input className="input mono" value={form.item} onChange={set("item")} inputMode="numeric" placeholder="ex.: 1" />
                </label>
                <label className="field">
                  <span className="field__label">Status</span>
                  <select className="input" value={form.status} onChange={set("status")}>
                    {(Object.keys(ROTULO_STATUS) as StatusItem[]).map((s) => (
                      <option key={s} value={s}>
                        {ROTULO_STATUS[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field" style={{ marginTop: "12px" }}>
                <span className="field__label">Planta / escopo</span>
                <input className="input" value={form.planta} onChange={set("planta")} placeholder="Ex.: Plantas de pavimento tipo — torre A" />
              </label>

              <div className="form-grid" style={{ marginTop: "12px" }}>
                <label className="field">
                  <span className="field__label">Data de início</span>
                  <input type="date" className="input mono" value={form.dataInicio} onChange={set("dataInicio")} />
                </label>
                <label className="field">
                  <span className="field__label">Prazo previsto</span>
                  <input type="date" className="input mono" value={form.prazoPrevisto} onChange={set("prazoPrevisto")} />
                </label>
                <label className="field">
                  <span className="field__label">Prazo reprogramado</span>
                  <input type="date" className="input mono" value={form.prazoReprogramado} onChange={set("prazoReprogramado")} />
                </label>
                <label className="field">
                  <span className="field__label">Prazo realizado</span>
                  <input type="date" className="input mono" value={form.prazoRealizado} onChange={set("prazoRealizado")} />
                </label>
                <label className="field">
                  <span className="field__label">Meta</span>
                  <input className="input mono" value={form.metaDias} onChange={set("metaDias")} placeholder="ex.: D+30" />
                </label>
              </div>

              <label className="field" style={{ marginTop: "12px" }}>
                <span className="field__label">Observações</span>
                <textarea className="input" rows={2} value={form.observacoes} onChange={set("observacoes")} style={{ resize: "vertical" }} />
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
