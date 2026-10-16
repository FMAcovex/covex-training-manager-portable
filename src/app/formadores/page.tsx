import AppShell from "@/app/app-shell";
import { PageHeader } from "@/app/components/ui";
import { canAccessAdministration } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";
import TrainersClient from "./trainers-client";

export const dynamic = "force-dynamic";

export default async function TrainersPage() {
  const user = await getPageUser();
  return <AppShell active="Formadores">
    <PageHeader
      title="Formadores"
      description="Registro maestro de formadores cualificados por materia conforme al PNT RH-00/008/02."
    />
    <TrainersClient canManage={canAccessAdministration(user)} />
  </AppShell>;
}
