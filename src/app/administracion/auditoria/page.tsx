import { redirect } from "next/navigation";
import AppShell from "@/app/app-shell";
import { canAccessAdministration } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";
import AdminNav from "../admin-nav";
import AuditClient from "./audit-client";
export const dynamic = "force-dynamic";
export default async function AuditPage() { if (!canAccessAdministration(await await getPageUser())) redirect("/"); return <AppShell active="Administración"><h1>Auditoría</h1><AdminNav /><p className="muted">Registro append-only generado por el servidor. Vista de solo lectura.</p><AuditClient /></AppShell>; }
