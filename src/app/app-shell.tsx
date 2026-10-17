import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { canAccessAdministration, canReadDocumentControl } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";
import { readRuntimeConfiguration } from "@/config/runtime";
import { AppIcon, type IconName } from "@/app/components/icons";
import PortableLogout from "@/app/components/portable-logout";

type NavigationLink = {
  label: string;
  href: string;
  icon: IconName;
  requiresDocumentation?: boolean;
  requiresAdministration?: boolean;
};

const links: NavigationLink[] = [
  { label: "Inicio", href: "/", icon: "home" },
  { label: "Formaciones", href: "/formaciones", icon: "training" },
  { label: "Plan anual", href: "/plan-anual", icon: "calendar" },
  { label: "Personal", href: "/personal", icon: "people" },
  { label: "Formadores", href: "/formadores", icon: "training" },
  { label: "Documentación", href: "/documentacion", icon: "document", requiresDocumentation: true },
  { label: "Administración", href: "/administracion", icon: "settings", requiresAdministration: true },
];

const roleLabel = {
  USER: "Usuario",
  RESPONSIBLE: "Responsable",
  ADMIN: "Administrador",
} as const;

function initials(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) ?? "CU").toUpperCase();
}

export default async function AppShell({ active, children }: { active: string; children: ReactNode }) {
  const user = await getPageUser();
  const runtime = readRuntimeConfiguration();
  const visibleLinks = links.filter(
    (link) =>
      (!link.requiresDocumentation || canReadDocumentControl(user)) &&
      (!link.requiresAdministration || canAccessAdministration(user)),
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-panel">
          <Image
            className="brand-logo"
            src="/brand/covex-logo.jpg"
            alt="COVEX"
            width={145}
            height={81}
            priority
          />
        </div>

        <nav className="nav" aria-label="Navegación principal">
          {visibleLinks.map((link) => {
            const selected = link.label === active;
            return (
              <Link
                className={selected ? "active" : ""}
                href={link.href}
                key={link.label}
                aria-current={selected ? "page" : undefined}
              >
                <AppIcon name={link.icon} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-product">
          <span>COVEX Training Manager</span>
          {runtime.authMode === "demo" && <span className="demo-chip">Modo demo</span>}
        </div>
      </aside>

      <div className="shell-content">
        {process.env.PORTABLE_DESKTOP_MODE && <aside className="portable-notice" role="note">{process.env.PORTABLE_DESKTOP_MODE === "demo" ? "DEMO — DATOS FICTICIOS · Interactiva, solo en memoria: los cambios desaparecen al cerrar · Sin importaciones, adjuntos ni conexión corporativa · No introduzcas datos reales" : "CANDIDATA — NO-GO para datos corporativos y uso GMP hasta validación de IT y Calidad"}</aside>}
        <header className="topbar">
          <div className="topbar-title">
            <span>Gestión de Formaciones</span>
            <strong>{active}</strong>
          </div>
          <div className="topbar-user" aria-label={`Usuario: ${user.displayName}. Rol: ${roleLabel[user.role]}`}>
            <div className="user-avatar" aria-hidden="true">{initials(user.displayName)}</div>
            <div>
              <strong>{user.displayName}</strong>
              <span>{roleLabel[user.role]}</span>
              {runtime.authMode === "portable-entra" && <PortableLogout />}
            </div>
          </div>
        </header>

        <main className="main">{children}</main>
      </div>
    </div>
  );
}
