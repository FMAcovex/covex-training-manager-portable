import AppShell from "@/app/app-shell";
import { PageHeader } from "@/app/components/ui";
import PortablePocClient from "./portable-poc-client";

export const dynamic = "force-dynamic";

export default function PortablePocPage() {
  return (
    <AppShell active="Administración">
      <PageHeader
        title="H10A · SharePoint portable"
        description="Prueba vertical aislada para validar Entra, Graph, una Formación y un documento sin migrar todavía el resto del modelo."
      />
      <PortablePocClient />
    </AppShell>
  );
}
