import { redirect } from "next/navigation";
import AppShell from "@/app/app-shell";
import { PageHeader } from "@/app/components/ui";
import { canReadDocumentControl } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";
import DocumentationClient from "./documentation-client";

export const dynamic = "force-dynamic";

export default async function DocumentationPage() {
  const user = await getPageUser();
  if (!canReadDocumentControl(user)) redirect("/");
  return <AppShell active="Documentación"><PageHeader title="Documentación" description="Revisa los controles de las sesiones ejecutadas y conserva sus evidencias adjuntas. Adjuntar un archivo no marca automáticamente la confirmación." /><DocumentationClient /></AppShell>;
}
