import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestão das Obras — Gestão de projetos técnicos",
  description: "Painel de acompanhamento de projetos técnicos de empreendimentos.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: extensões de navegador (ColorZilla, Dark Reader)
    // e o next-themes (via auth-ui) mutam <html>/<body> antes da hidratação.
    // Silencia só o mismatch desses nós de topo — não afeta o resto da árvore.
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
