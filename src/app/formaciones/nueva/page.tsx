import Link from "next/link";
import AppShell from "@/app/app-shell";
import { PageHeader } from "@/app/components/ui";
import TrainingForm from "../training-form";

export default function NewTrainingPage() {
  return (
    <AppShell active="Nueva formación">
      <PageHeader
        title="Nueva formación"
        description="Define la acción formativa. Después podrás añadir una o varias sesiones desde su ficha."
        action={<Link className="button-link secondary-link" href="/formaciones">Volver al listado</Link>}
      />
      <TrainingForm />
    </AppShell>
  );
}
