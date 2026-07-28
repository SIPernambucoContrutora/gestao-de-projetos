"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PapelUsuario } from "@/db/schema";
import { createUsuario } from "@/lib/actions/usuarios";

const PAPEIS: { valor: PapelUsuario; rotulo: string }[] = [
  { valor: "equipe", rotulo: "Equipe" },
  { valor: "admin", rotulo: "Admin" },
  { valor: "leitura", rotulo: "Leitura" },
];

const VAZIO = { nome: "", email: "", senha: "", papel: "equipe" as PapelUsuario };

export function NovoUsuarioButton() {
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
    if (!form.nome.trim()) return setErro("Informe o nome.");
    if (!form.email.trim()) return setErro("Informe o e-mail.");
    if (form.senha.length < 8) return setErro("A senha deve ter ao menos 8 caracteres.");
    setSalvando(true);
    setErro(null);
    try {
      await createUsuario(form);
      router.refresh();
      setSalvando(false);
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar usuário.");
      setSalvando(false);
    }
  }

  const set =
    (campo: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setAberto(true)}>
        Novo usuário
      </button>

      {aberto && (
        <div>
          <div className="modal-overlay" onClick={fechar} />
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h2 className="modal-title">Novo usuário</h2>
              <button type="button" className="drawer-close" onClick={fechar} aria-label="Fechar">
                ×
              </button>
            </div>

            <div className="modal-body">
              <label className="field">
                <span className="field__label">Nome *</span>
                <input className="input" value={form.nome} onChange={set("nome")} autoFocus style={{ width: "100%" }} />
              </label>
              <label className="field" style={{ marginTop: "12px" }}>
                <span className="field__label">E-mail *</span>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="nome.sobrenome@pernambucoconstrutora.com.br"
                  style={{ width: "100%" }}
                />
              </label>
              <div className="form-grid" style={{ marginTop: "12px" }}>
                <label className="field">
                  <span className="field__label">Senha * (mín. 8)</span>
                  <input type="password" className="input" value={form.senha} onChange={set("senha")} />
                </label>
                <label className="field">
                  <span className="field__label">Papel</span>
                  <select className="input" value={form.papel} onChange={set("papel")}>
                    {PAPEIS.map((p) => (
                      <option key={p.valor} value={p.valor}>
                        {p.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="field__hint" style={{ marginTop: "12px" }}>
                O usuário poderá entrar imediatamente com este e-mail e senha. Informe a senha a ele
                por um canal seguro; ele pode trocá-la depois.
              </p>
            </div>

            <div className="modal-foot">
              {erro && <span className="drawer-foot__erro">{erro}</span>}
              <button type="button" className="btn-soft" onClick={fechar} disabled={salvando}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? "Criando…" : "Criar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
