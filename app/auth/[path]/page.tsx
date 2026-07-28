import { LoginForm } from "../LoginForm";

// Qualquer caminho sob /auth (sign-in, etc.) mostra o login customizado.
// Cadastro/reset ficam a cargo do admin no console da Neon.
export const dynamic = "force-dynamic";

export default function AuthPage() {
  return <LoginForm />;
}
