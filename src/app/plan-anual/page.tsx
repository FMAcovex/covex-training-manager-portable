import AppShell from "@/app/app-shell";
import { PageHeader } from "@/app/components/ui";
import AnnualPlanClient from "./annual-plan-client";
import { canGenerateAnnexIV } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";
import { getAnnualPlanService } from "@/annual-plan/annual-plan-services";

export const dynamic = "force-dynamic";

export default async function AnnualPlanPage() {
  const user = await getPageUser();
  const availableYears = await getAnnualPlanService().getAvailableYears(user);
  return <AppShell active="Plan anual"><PageHeader title="Plan anual" description="Seguimiento anual de las formaciones planificadas y de las incorporadas durante el ejercicio." /><AnnualPlanClient canGenerate={canGenerateAnnexIV(user)} availableYears={availableYears} /></AppShell>;
}
