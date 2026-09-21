"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoriaDisciplina, Disciplina } from "@/db/schema";
import { createDisciplina, deleteDisciplina, updateDisciplina } from "@/lib/actions/disciplinas";

const CATEGORIAS: { valor: CategoriaDisciplina; rotulo: string }[] = [
  { valor: "obra", rotulo: "Obra" },
  { valor: "lancamento", rotulo: "Lançamento" },
];

type Form = { nome: string; categoria: CategoriaDisciplina | "" };

/** Cadastro/edição de disciplina. Sem `disciplina`, abre em modo de criação. */
export function DisciplinaFormModal({
  disciplina,
  onClose,
}: {
  disciplina?: Disciplina;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>({
    nome: disciplina?.nome ?? "",
    categoria: disciplina?.categoria ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!form.nome.trim()) return setErro("Informe o nome da disciplina.");
    setSalvando(true);
    setErro(null);
    try {
      const categoria = form.categoria || null;
      if (disciplina) {
        await updateDisciplina(disciplina.id, { nome: form.nome, categoria });
      } else {
        await createDisciplina({ nome: form.nome, categoria });
      }
      router.refresh();
      setSalvando(false);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!disciplina) return;
    if (
      !window.confirm(`Excluir a disciplina "${disciplina.nome}"? Esta ação não pode ser desfeita.`)
    ) {
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await deleteDisciplina(disciplina.id);
      router.refresh();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir.");
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="modal-overlay" onClick={() => !salvando && onClose()} />
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2 className="modal-title">{disciplina ? "Editar disciplina" : "Nova disciplina"}</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span className="field__label">Nome da disciplina *</span>
            <input
              className="input"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Estrutura"
              autoFocus
            />
          </label>
          <label className="field" style={{ marginTop: "12px" }}>
            <span className="field__label">Categoria</span>
            <select
              className="input"
              value={form.categoria}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoria: e.target.value as CategoriaDisciplina | "" }))
              }
            >
              <option value="">— Sem categoria —</option>
              {CATEGORIAS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.rotulo}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="modal-foot">
          {disciplina && (
            <button type="button" className="btn-danger" onClick={excluir} disabled={salvando}>
              Excluir
            </button>
          )}
          {erro && <span className="drawer-foot__erro">{erro}</span>}
          <button type="button" className="btn-soft" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : disciplina ? "Salvar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
