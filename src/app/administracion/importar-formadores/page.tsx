import { redirect } from "next/navigation";
import AppShell from "@/app/app-shell";
import { canAccessAdministration } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";
import AdminNav from "../admin-nav";
import TrainerImportClient from "./trainer-import-client";

export const dynamic = "force-dynamic";

export default async function TrainerImportPage() {
  if (!canAccessAdministration(await getPageUser())) redirect("/");
  return <AppShell active="Administración">
    <div className="page-heading"><div><h1>Importar formadores cualificados</h1><p className="muted">Carga controlada del Anexo III del PNT RH-00/008/02.</p></div><span className="readiness-badge">Solo administradores</span></div>
    <AdminNav />
    <TrainerImportClient />
  </AppShell>;
}
