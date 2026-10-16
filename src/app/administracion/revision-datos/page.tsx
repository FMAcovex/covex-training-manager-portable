import { redirect } from "next/navigation";
import AppShell from "@/app/app-shell";
import { PageHeader } from "@/app/components/ui";
import { canAccessAdministration } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";
import { getTrainingIntegrityService } from "@/integrity/training-integrity-services";
import AdminNav from "../admin-nav";
import IntegrityReviewClient from "./integrity-review-client";

export const dynamic = "force-dynamic";

export default async function DataReviewPage() {
  const user = await getPageUser();
  if (!canAccessAdministration(user)) redirect("/");
  const report = await getTrainingIntegrityService().review(user);

  return (
    <AppShell active="Administración">
      <PageHeader
        title="Revisión de datos"
        description="Integridad y pendientes de Formaciones, Sesiones y sus referencias maestras."
      />
      <AdminNav />
      <IntegrityReviewClient report={report} />
    </AppShell>
  );
}
