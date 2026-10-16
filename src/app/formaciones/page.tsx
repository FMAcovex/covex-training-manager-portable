import Link from "next/link";
import AppShell from "@/app/app-shell";
import { PageHeader } from "@/app/components/ui";
import TrainingsClient from "./trainings-client";

export default function TrainingsPage() {
  return (
    <AppShell active="Formaciones">
      <PageHeader
        title="Formaciones"
        description="Consulta y gestiona las acciones formativas y su estado de ejecución."
        action={<Link className="button-link" href="/formaciones/nueva">Nueva formación</Link>}
      />
      <TrainingsClient />
    </AppShell>
  );
}
