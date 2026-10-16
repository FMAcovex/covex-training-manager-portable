import AppShell from "@/app/app-shell";
import TrainingDetailClient from "./training-detail-client";
import { canCloseTraining, canEditTraining, canReadDocumentControl, canUpdateDocumentControl } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";

type Props = { params: Promise<{ id: string }> };

export default async function TrainingDetailPage({ params }: Props) {
  const user = await getPageUser();
  return <AppShell active="Formaciones"><TrainingDetailClient id={(await params).id} canEdit={canEditTraining(user)} canManageClosure={canCloseTraining(user)} canReadDocumentControl={canReadDocumentControl(user)} canUpdateDocumentControl={canUpdateDocumentControl(user)} /></AppShell>;
}
