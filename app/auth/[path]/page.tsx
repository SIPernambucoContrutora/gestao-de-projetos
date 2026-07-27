import { AuthView } from "@neondatabase/auth-ui";

// Telas de login/cadastro/reset renderizadas pelo Neon Auth UI.
// /auth/sign-in, /auth/sign-up, /auth/forgot-password, ...
export const dynamic = "force-dynamic";

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <AuthView pathname={path} />
    </main>
  );
}
