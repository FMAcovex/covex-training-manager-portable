import { redirect } from "next/navigation";
import AppShell from "@/app/app-shell";
import { canAccessAdministration } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";
import AdminNav from "../admin-nav";
import TrainingImportClient from "./training-import-client";

export const dynamic = "force-dynamic";

export default async function TrainingImportPage() {
  if (!canAccessAdministration(await getPageUser())) redirect("/");
  return <AppShell active="Administración">
    <div className="page-heading">
      <div><h1>Importar formaciones</h1><p className="muted">Migración controlada desde la plantilla de seguimiento 2026.</p></div>
      <span className="readiness-badge">Solo administradores</span>
    </div>
    <AdminNav />
    <TrainingImportClient />
  </AppShell>;
}

