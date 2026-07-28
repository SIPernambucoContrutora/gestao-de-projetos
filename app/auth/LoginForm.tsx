"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

// Login fiel ao protótipo estático. Sem cadastro: novos usuários são
// criados pelo admin no console da Neon (neon_auth) e recebem papel via
// a tela de Usuários.
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      const { error } = await authClient.signIn.email({ email, password: senha });
      if (error) {
        setErro(error.message || "E-mail ou senha inválidos.");
        setEntrando(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErro("Não foi possível entrar. Tente novamente.");
      setEntrando(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-inner">
        <div className="login-brand">
          <img src="/brand/logo-login.png" alt="Gestão das Obras" className="login__logo" />
          <div className="login-brand__title">GESTÃO DE PROJETOS</div>
          <div className="login-brand__sub">Acompanhamento de projetos técnicos</div>
        </div>

        <form className="login-card" onSubmit={entrar}>
          <h1 className="login-card__title">Entrar</h1>

          <label className="field" style={{ marginBottom: "14px" }}>
            <span className="field__label">E-mail</span>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome.sobrenome@pernambucoconstrutora.com.br"
              autoComplete="email"
              autoFocus
              style={{ width: "100%" }}
            />
          </label>

          <label className="field" style={{ marginBottom: "18px" }}>
            <span className="field__label">Senha</span>
            <input
              type="password"
              className="input"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{ width: "100%" }}
            />
          </label>

          {erro && <div className="login-erro">{erro}</div>}

          <button type="submit" className="btn-primary login-submit" disabled={entrando}>
            {entrando ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="login-foot">
          Acesso restrito à equipe. Novos usuários são cadastrados por um administrador.
        </div>
      </div>
    </div>
  );
}
