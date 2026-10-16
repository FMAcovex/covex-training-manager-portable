import { redirect } from "next/navigation";
import AppShell from "@/app/app-shell";
import { canAccessAdministration } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";
import AdminNav from "../admin-nav";
import CatalogsClient from "./catalogs-client";
export const dynamic = "force-dynamic";
export default async function CatalogsPage() { if (!canAccessAdministration(await await getPageUser())) redirect("/"); return <AppShell active="Administración"><h1>Catálogos</h1><AdminNav /><p className="muted">Los elementos históricos no se sobrescriben ni se borran físicamente.</p><CatalogsClient /></AppShell>; }
