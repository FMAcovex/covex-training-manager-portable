"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui";
import type { Training } from "@/domain/training";
import SessionForm from "@/app/sesiones/session-form";
export default function NewSessionClient({ trainingId }: { trainingId: string }) {
  const [training, setTraining] = useState<Training>();
  const [notFound, setNotFound] = useState(false);
  useEffect(() => { void fetch(`/api/trainings/${trainingId}`).then(async (response) => response.ok ? setTraining(await response.json()) : setNotFound(true)); }, [trainingId]);
  if (notFound) return <p>Formación no encontrada.</p>;
  if (!training) return <p>Cargando…</p>;
  return <><PageHeader title="Añadir sesión" description={`${training.code} · ${training.name}`} action={<Link className="button-link secondary-link" href={`/formaciones/${training.id}`}>Cancelar</Link>} /><section className="card"><SessionForm training={training} /></section></>;
}
