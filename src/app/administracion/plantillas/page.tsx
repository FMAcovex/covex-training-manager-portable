import { redirect } from "next/navigation";
import AppShell from "@/app/app-shell";
import { canAccessAdministration } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";
import AdminNav from "../admin-nav";
import TemplatesClient from "./templates-client";
export const dynamic = "force-dynamic";
export default async function TemplatesPage() { if (!canAccessAdministration(await getPageUser())) redirect("/"); return <AppShell active="Administración"><h1>Versiones de plantilla</h1><AdminNav /><p className="muted">Registro de metadata únicamente. Este hito no sube archivos ni conecta SharePoint.</p><TemplatesClient /></AppShell>; }
