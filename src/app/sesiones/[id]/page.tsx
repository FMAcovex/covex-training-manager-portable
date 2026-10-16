import AppShell from "@/app/app-shell";
import SessionDetailClient from "./session-detail-client";
import { canCloseSession, canEditSession, canReadDocumentControl, canReopenSession, canUpdateDocumentControl } from "@/auth/current-user";
import { getPageUser } from "@/auth/page-user";

type Props = { params: Promise<{ id: string }> };

export default async function SessionPage({ params }: Props) {
  const user = await getPageUser();
  return (
    <AppShell active="Formaciones">
      <SessionDetailClient
        id={(await params).id}
        canEditPending={canEditSession(user, "PENDING")}
        canEditClosed={canEditSession(user, "EXECUTED")}
        canClose={canCloseSession(user)}
        canReopen={canReopenSession(user)}
        canReadDocumentControl={canReadDocumentControl(user)}
        canUpdateDocumentControl={canUpdateDocumentControl(user)}
      />
    </AppShell>
  );
}
