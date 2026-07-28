import { getCurrentUserWithRole } from "@/lib/auth/session";
import { listUsuarios } from "@/lib/actions/usuarios";
import type { UsuarioListado } from "@/lib/actions/usuarios";
import { UsuariosTable } from "../_components/UsuariosTable";
import { NovoUsuarioButton } from "../_components/NovoUsuarioButton";

export const metadata = { title: "Usuários — Gestão das Obras" };

export default async function UsuariosPage() {
  let ctx = null;
  try {
    ctx = await getCurrentUserWithRole();
  } catch {
    ctx = null;
  }

  if (!ctx) {
    return (
      <div>
        <Header />
        <div className="empty-state">Entre com sua conta para acessar esta página.</div>
      </div>
    );
  }

  if (ctx.papel !== "admin") {
    return (
      <div>
        <Header />
        <div className="empty-state">
          Acesso restrito. Apenas administradores podem gerir usuários e papéis.
        </div>
      </div>
    );
  }

  let usuarios: UsuarioListado[] = [];
  let erro: string | null = null;
  try {
    usuarios = await listUsuarios();
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha ao carregar usuários.";
  }

  return (
    <div>
      <Header acao={<NovoUsuarioButton />} />
      <section style={{ padding: "20px 28px 48px", maxWidth: "900px" }}>
        {erro ? (
          <div className="usuarios-erro">{erro}</div>
        ) : usuarios.length === 0 ? (
          <div className="empty-state" style={{ margin: 0 }}>
            Nenhum usuário encontrado.
          </div>
        ) : (
          <UsuariosTable usuarios={usuarios} currentUserId={ctx.user.id} />
        )}
      </section>
    </div>
  );
}

function Header({ acao }: { acao?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-head__row">
        <div>
          <h1 className="page-head__title">Usuários</h1>
          <p className="page-head__sub">
            Somente administradores podem criar usuários ou alterar papéis
          </p>
        </div>
        {acao}
      </div>
    </header>
  );
}
