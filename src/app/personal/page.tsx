import AppShell from "@/app/app-shell";
import { PageHeader } from "@/app/components/ui";
import PeopleClient from "./people-client";
import { canManagePeople, canReadPersonHistory } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";

export default async function PersonalPage() {
  const user = await getPageUser();
  return (
    <AppShell active="Personal">
      <PageHeader title="Personal" description="Maestro de personal interno y externo y acceso a su historial formativo." />
      <PeopleClient canManage={canManagePeople(user)} canReadHistory={canReadPersonHistory(user)} />
    </AppShell>
  );
}
