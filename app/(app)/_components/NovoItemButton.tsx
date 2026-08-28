"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Disciplina, Etapa, PrioridadeItem, Projetista, StatusItem } from "@/db/schema";
import { createItem } from "@/lib/actions/itens";
import type { UsuarioBasico } from "@/lib/actions/usuarios";
import {
  PRIORIDADES,
  resolverStatus,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS,
  STATUS_SELECIONAVEIS,
} from "@/lib/ui/status";

const VAZIO = {
  disciplinaId: "",
  etapaId: "",
  projetistaId: "",
  planta: "",
  status: "pendente" as StatusItem,
  prioridade: "media" as PrioridadeItem,
  usuarioAnaliseId: "",
  dataInicio: "",
  prazoPrevisto: "",
  prazoReprogramado: "",
  prazoRealizado: "",
  observacoes: "",
};

export function NovoItemButton({
  empreendimentoId,
  disciplinas,
  etapas,
  projetistas,
  usuarios,
}: {
  empreendimentoId: string;
  disciplinas: Disciplina[];
  etapas: Etapa[];
  projetistas: Projetista[];
  usuarios: UsuarioBasico[];
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

  const emAnalise = form.status === "em_analise";
  // O par 'Pendente'/'Em andamento' é derivado do prazo previsto, nunca
  // escolhido: sem previsto só 'Pendente' é possível e 'Em andamento' sai da
  // lista. Encerrar o item ou mandar para análise segue liberado.
  const semPrevisto = !form.prazoPrevisto;
  const pendente = form.status === "pendente";
  const opcoesStatus = semPrevisto
    ? STATUS_SELECIONAVEIS.filter((s) => s !== "em_andamento")
    : STATUS_SELECIONAVEIS;

  // Mexer no prazo previsto reavalia o status na hora, nos dois sentidos.
  function setPrazoPrevisto(e: React.ChangeEvent<HTMLInputElement>) {
    const prazoPrevisto = e.target.value;
    setForm((f) => ({
      ...f,
      prazoPrevisto,
      status: resolverStatus(f.status, prazoPrevisto),
    }));
  }

  async function salvar() {
    if (!form.disciplinaId) return setErro("Selecione a disciplina.");
    if (!form.etapaId) return setErro("Selecione a etapa.");
    if (emAnalise && !form.usuarioAnaliseId) {
      return setErro("Selecione o usuário da análise para salvar o status Em análise.");
    }
    setSalvando(true);
    setErro(null);
    try {
      await createItem({
        empreendimentoId,
        disciplinaId: form.disciplinaId,
        etapaId: form.etapaId,
        projetistaId: form.projetistaId || null,
        planta: form.planta || null,
        status: form.status,
        prioridade: form.prioridade,
        usuarioAnaliseId: emAnalise ? form.usuarioAnaliseId : null,
        dataInicio: form.dataInicio || null,
        prazoPrevisto: form.prazoPrevisto || null,
        prazoReprogramado: form.prazoReprogramado || null,
        prazoRealizado: form.prazoRealizado || null,
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
                  <span className="field__label">Projetista</span>
                  <select className="input" value={form.projetistaId} onChange={set("projetistaId")}>
                    <option value="">Sem projetista</option>
                    {projetistas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Status</span>
                  <select className="input" value={form.status} onChange={set("status")}>
                    {pendente && (
                      <option value="pendente" disabled>
                        {ROTULO_STATUS.pendente}
                      </option>
                    )}
                    {opcoesStatus.map((s) => (
                      <option key={s} value={s}>
                        {ROTULO_STATUS[s]}
                      </option>
                    ))}
                  </select>
                  {semPrevisto && (
                    <span className="field__hint">
                      Sem prazo previsto o item fica Pendente. Informe o previsto para
                      ele entrar em andamento.
                    </span>
                  )}
                </label>
                <label className="field">
                  <span className="field__label">Prioridade</span>
                  <select className="input" value={form.prioridade} onChange={set("prioridade")}>
                    {PRIORIDADES.map((p) => (
                      <option key={p} value={p}>
                        {ROTULO_PRIORIDADE[p]}
                      </option>
                    ))}
                  </select>
                </label>
                {emAnalise && (
                  <label className="field">
                    <span className="field__label">Usuário da análise *</span>
                    <select className="input" value={form.usuarioAnaliseId} onChange={set("usuarioAnaliseId")}>
                      <option value="">Selecione…</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
                  <input type="date" className="input mono" value={form.prazoPrevisto} onChange={setPrazoPrevisto} />
                </label>
                <label className="field">
                  <span className="field__label">Prazo reprogramado</span>
                  <input type="date" className="input mono" value={form.prazoReprogramado} onChange={set("prazoReprogramado")} />
                </label>
                <label className="field">
                  <span className="field__label">Prazo realizado</span>
                  <input type="date" className="input mono" value={form.prazoRealizado} onChange={set("prazoRealizado")} />
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
