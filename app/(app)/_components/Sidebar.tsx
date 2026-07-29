"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

type NavKey = "dashboard" | "empreendimentos" | "projetistas" | "historico" | "usuarios";

const NAV: { href: string; label: string; icon: NavKey; match: string }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", match: "/" },
  { href: "/empreendimentos", label: "Empreendimentos", icon: "empreendimentos", match: "/empreendimentos" },
  { href: "/projetistas", label: "Projetistas", icon: "projetistas", match: "/projetistas" },
  { href: "/historico", label: "Histórico", icon: "historico", match: "/historico" },
  { href: "/usuarios", label: "Usuários", icon: "usuarios", match: "/usuarios" },
];

function NavIcon({ name }: { name: NavKey }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
  };
  if (name === "dashboard")
    return (
      <svg {...common}>
        <rect x="1.5" y="1.5" width="5" height="5" />
        <rect x="9.5" y="1.5" width="5" height="5" />
        <rect x="1.5" y="9.5" width="5" height="5" />
        <rect x="9.5" y="9.5" width="5" height="5" />
      </svg>
    );
  if (name === "empreendimentos")
    return (
      <svg {...common}>
        <rect x="1.5" y="4.5" width="6" height="10" />
        <rect x="9.5" y="1.5" width="5" height="13" />
      </svg>
    );
  if (name === "historico")
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="6.2" />
        <polyline points="8,4.4 8,8 10.6,9.6" />
      </svg>
    );
  if (name === "projetistas")
    return (
      <svg {...common}>
        <path d="M2.5 13.5 11 5l1.5 1.5L4 15H2.5v-1.5Z" />
        <path d="M9.5 6.5 11.5 3.5 13.5 4.5 11.5 8" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="8" cy="5.5" r="2.8" />
      <path d="M2.6 14.2c0-2.6 2.4-4.2 5.4-4.2s5.4 1.6 5.4 4.2" />
    </svg>
  );
}

export function Sidebar({ userName, userRole }: { userName: string; userRole: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    try {
      await authClient.signOut();
    } catch {
      /* mesmo se falhar, força ida pro login */
    }
    router.push("/auth/sign-in");
    router.refresh();
  }

  const iniciais = userName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        {/* Logo servida de public/brand — img simples basta para um asset fixo. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="Gestão das Obras" className="sidebar__logo" />
        <div className="sidebar__brand-sub">Gestão de projetos</div>
      </div>

      <nav className="sidebar__nav">
        {NAV.map((n) => {
          const active = pathname === n.match || pathname.startsWith(`${n.match}/`);
          return (
            <Link
              key={n.icon}
              href={n.href}
              className={`nav-item${active ? " nav-item--active" : ""}`}
            >
              <NavIcon name={n.icon} />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar__user">
        <div className="sidebar__avatar">{iniciais || "?"}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="sidebar__user-name">{userName}</div>
          <div className="sidebar__user-role">{userRole}</div>
        </div>
        <button
          type="button"
          className="sidebar__sair"
          onClick={sair}
          disabled={saindo}
          title="Sair"
          aria-label="Sair"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}>
            <path d="M6 2.5H3.5A1 1 0 0 0 2.5 3.5v9a1 1 0 0 0 1 1H6" />
            <polyline points="10,4.5 13.5,8 10,11.5" />
            <line x1="13.5" y1="8" x2="6" y2="8" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
