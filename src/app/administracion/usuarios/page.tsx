import { redirect } from "next/navigation";
import AppShell from "@/app/app-shell";
import { canAccessAdministration } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";
import AdminNav from "../admin-nav";
import UsersClient from "./users-client";
export const dynamic = "force-dynamic";
export default async function UsersPage() { if (!canAccessAdministration(await getPageUser())) redirect("/"); return <AppShell active="Administración"><h1>Usuarios</h1><AdminNav /><p className="card milestone-note">Los perfiles y roles quedan preparados; la autenticación real con Microsoft Entra se conectará en el Hito 8. No se gestionan contraseñas.</p><UsersClient /></AppShell>; }
