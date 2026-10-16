"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui";
import { ConfirmActionDialog } from "@/app/components/confirm-action-dialog";
import { formatDateEs } from "@/app/lib/format";
import type { Department } from "@/domain/department";
import type { Person } from "@/domain/person";
import type { TrainingCatalogs } from "@/domain/training-catalogs";
import type { Training } from "@/domain/training";
import type { TrainingSession } from "@/domain/training-session";
import TrainingForm from "../training-form";
import TrainingDocumentControl from "./training-document-control";

const label = (value: string | number | undefined) => value === undefined || value === "" ? "—" : String(value);

type ClosureState = { closed: boolean; ready: boolean; closedAt?: string; closedByUserId?: string; blockingReasons: string[] };

export default function TrainingDetailClient({ id, canEdit, canManageClosure, canReadDocumentControl, canUpdateDocumentControl }: { id: string; canEdit: boolean; canManageClosure: boolean; canReadDocumentControl: boolean; canUpdateDocumentControl: boolean }) {
  const [training, setTraining] = useState<Training>();
  const [catalogs, setCatalogs] = useState<TrainingCatalogs>({ trainingTypes: [], modalities: [], evaluationMethods: [] });
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editing, setEditing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [sessionStatus, setSessionStatus] = useState("");
  const [closure, setClosure] = useState<ClosureState>();
  const [closureError, setClosureError] = useState("");
  const [closureBusy, setClosureBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch(`/api/trainings/${id}`),
      fetch("/api/training-catalogs?includeInactive=true").then((response) => response.json()),
      fetch("/api/people").then((response) => response.json()),
      fetch("/api/departments?includeInactive=true").then((response) => response.json()),
      fetch(`/api/trainings/${id}/sessions`).then((response) => response.json()),
      fetch(`/api/trainings/${id}/closure`).then((response) => response.ok ? response.json() : undefined),
    ]).then(async ([trainingResponse, loadedCatalogs, loadedPeople, loadedDepartments, loadedSessions, loadedClosure]) => {
      if (!trainingResponse.ok) { setNotFound(true); return; }
      setTraining(await trainingResponse.json()); setCatalogs(loadedCatalogs); setPeople(loadedPeople); setDepartments(loadedDepartments); setSessions(loadedSessions); setClosure(loadedClosure);
    });
  }, [id]);

  if (notFound) return <><h1>Formación no encontrada</h1><Link className="text-link" href="/formaciones">Volver al listado</Link></>;
  if (!training) return <p>Cargando formación…</p>;

  const catalogName = (items: TrainingCatalogs[keyof TrainingCatalogs], itemId?: string) => items.find((item) => item.id === itemId)?.name;
  const internalTrainerIds = training.plannedTrainerPersonIds?.length ? training.plannedTrainerPersonIds : training.plannedTrainerPersonId ? [training.plannedTrainerPersonId] : [];
  const externalTrainerNames = training.externalTrainerNames?.length ? training.externalTrainerNames : training.externalTrainerName ? [training.externalTrainerName] : [];
  const trainer = [
    ...internalTrainerIds.map((trainerId) => people.find((person) => person.id === trainerId)?.fullName).filter((name): name is string => Boolean(name)),
    ...externalTrainerNames,
  ].join(", ");
  const targetDepartments = (training.targetDepartmentIds ?? []).map((departmentId) => departments.find((department) => department.id === departmentId)?.name).filter(Boolean).join(", ");
  const sessionTrainer = (session: TrainingSession) => {
    const sessionInternal = session.trainerPersonIds?.length ? session.trainerPersonIds : session.trainerPersonId ? [session.trainerPersonId] : [];
    const sessionExternal = session.externalTrainerNames?.length ? session.externalTrainerNames : session.externalTrainerName ? [session.externalTrainerName] : [];
    return [
      ...sessionInternal.map((trainerId) => people.find((person) => person.id === trainerId)?.fullName).filter((name): name is string => Boolean(name)),
      ...sessionExternal,
    ].join(", ");
  };
  const visibleSessions = sessions.filter((session) => !sessionStatus || session.executionStatus === sessionStatus);

  async function refreshClosure() {
    const [trainingResponse, closureResponse] = await Promise.all([fetch(`/api/trainings/${id}`), fetch(`/api/trainings/${id}/closure`)]);
    if (trainingResponse.ok) setTraining(await trainingResponse.json());
    if (closureResponse.ok) setClosure(await closureResponse.json());
  }

  async function closeTraining() {
    setClosureBusy(true); setClosureError("");
    const response = await fetch(`/api/trainings/${id}/closure`, { method: "POST" });
    const result = await response.json().catch(() => ({})); setClosureBusy(false);
    if (!response.ok) { setConfirmClose(false); setClosureError(result.error ?? "No se ha podido cerrar la formación"); return; }
    setConfirmClose(false); await refreshClosure();
  }

  async function reopenTraining() {
    if (!reopenReason.trim()) { setClosureError("El motivo de reapertura es obligatorio"); return; }
    setClosureBusy(true); setClosureError("");
    const response = await fetch(`/api/trainings/${id}/closure`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reopenReason }) });
    const result = await response.json().catch(() => ({})); setClosureBusy(false);
    if (!response.ok) { setConfirmReopen(false); setClosureError(result.error ?? "No se ha podido reabrir la formación"); return; }
    setConfirmReopen(false); setReopenReason(""); await refreshClosure();
  }

  return <><PageHeader title={training.name} description={training.code} action={<div className="button-row"><Link className="button-link secondary-link" href="/formaciones">Volver</Link>{canEdit && <button type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Cerrar edición" : "Editar"}</button>}</div>} />
    {editing ? <TrainingForm initial={training} onSaved={(updated) => { setTraining(updated); setEditing(false); }} /> : <section className="card"><h2>Datos generales</h2><dl className="details-grid">
      <div><dt>Código</dt><dd>{training.code}</dd></div><div><dt>Estado global</dt><dd><span className={`badge status-${(training.globalStatus ?? "PENDING").toLowerCase()}`}>{training.globalStatus === "EXECUTED" ? "Ejecutada" : training.globalStatus === "NOT_EXECUTED" ? "No ejecutada" : "Pendiente"}</span></dd></div><div><dt>Cierre documental</dt><dd><span className={`badge ${closure?.closed ? "status-executed" : closure?.ready ? "status-document-conforming" : "status-pending"}`}>{closure?.closed ? "Cerrada" : closure?.ready ? "Preparada para cierre" : "Abierta"}</span>{closure?.closedAt && <><br /><small>{formatDateEs(closure.closedAt)}</small></>}</dd></div><div><dt>Año</dt><dd>{training.year}</dd></div>
      <div><dt>Planificación</dt><dd>{training.planningType === "PLANNED" ? "Planificada" : "No planificada"}</dd></div><div><dt>Motivo</dt><dd>{label(training.reason)}</dd></div>
      <div><dt>Tipo</dt><dd>{label(catalogName(catalogs.trainingTypes, training.trainingTypeId))}</dd></div><div><dt>GMP</dt><dd>{training.isGmp ? "Sí" : "No"}</dd></div>
      <div><dt>Origen</dt><dd>{training.originType === "INTERNAL" ? "Interna" : "Externa"}</dd></div><div><dt>Modalidad</dt><dd>{label(catalogName(catalogs.modalities, training.modalityId))}</dd></div>
      <div><dt>Duración prevista</dt><dd>{training.plannedDurationMinutes ? `${training.plannedDurationMinutes} minutos` : "—"}</dd></div><div><dt>Formador previsto</dt><dd>{label(trainer)}</dd></div>
      <div><dt>Material / referencia</dt><dd>{label(training.materialReference)}</dd></div><div><dt>Colectivo objetivo</dt><dd>{label(training.targetGroup)}</dd></div>
      <div className="full-width"><dt>Departamentos destinatarios</dt><dd>{label(targetDepartments)}</dd></div>
      <div className="full-width"><dt>Contenido</dt><dd>{label(training.content)}</dd></div>
      <div><dt>Método de evaluación</dt><dd>{label(catalogName(catalogs.evaluationMethods, training.evaluationMethodId))}</dd></div><div><dt>Criterio de aptitud</dt><dd>{label(training.aptitudeCriterion)}</dd></div>
      <div><dt>Frecuencia</dt><dd>{training.frequencyMonths ? `${training.frequencyMonths} meses` : "—"}</dd></div><div><dt>Creada</dt><dd>{formatDateEs(training.createdAt)}</dd></div>
      <div className="full-width"><dt>Observaciones</dt><dd>{label(training.notes)}</dd></div>
    </dl></section>}
    <TrainingDocumentControl trainingId={training.id} canRead={canReadDocumentControl} canUpdate={canUpdateDocumentControl} onChanged={refreshClosure} />
    <section className="card"><div className="toolbar"><div><h2>Cierre de la formación</h2><p className="muted">El cierre documental es independiente del estado de ejecución. La formación sigue siendo editable aunque esté cerrada.</p></div></div>
      {closure?.closed ? <>
        <p><strong>Formación cerrada documentalmente.</strong></p>
        {canManageClosure && <><label>Motivo de reapertura *<textarea value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} /></label><div className="form-actions"><button className="secondary" type="button" disabled={!reopenReason.trim()} onClick={() => setConfirmReopen(true)}>Reabrir formación</button></div></>}
      </> : <>
        {closure?.ready ? <p className="success">Todas las sesiones están ejecutadas y su control documental permite cerrar la formación.</p> : <><p className="muted">Todavía no puede cerrarse:</p><ul>{closure?.blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></>}
        {canManageClosure && <button type="button" disabled={!closure?.ready || closureBusy} onClick={() => setConfirmClose(true)}>Cerrar formación</button>}
      </>}
      {closureError && <p className="error" role="alert">{closureError}</p>}
    </section>
    <section className="card table-card"><div className="toolbar"><h2>Sesiones</h2><div className="button-row"><label>Estado<select value={sessionStatus} onChange={(event) => setSessionStatus(event.target.value)}><option value="">Todos</option><option value="PENDING">Pendiente</option><option value="EXECUTED">Ejecutada</option><option value="NOT_EXECUTED">No ejecutada</option></select></label><Link className="button-link" href={`/formaciones/${training.id}/sesiones/nueva`}>Añadir sesión</Link></div></div><div className="table-scroll"><table><thead><tr><th>Código</th><th>Fecha prevista</th><th>Fecha ejecución</th><th>Formador</th><th>Duración</th><th>Estado</th><th>Asistentes</th></tr></thead><tbody>{visibleSessions.map((session) => <tr key={session.id}><td><Link className="text-link" href={`/sesiones/${session.id}`}>{session.code}</Link></td><td>{formatDateEs(session.plannedDate)}</td><td>{formatDateEs(session.executionDate)}</td><td>{sessionTrainer(session) || "—"}</td><td>{session.durationMinutes} min</td><td>{session.executionStatus === "EXECUTED" ? "Ejecutada" : session.executionStatus === "NOT_EXECUTED" ? "No ejecutada" : "Pendiente"}</td><td>{session.attendances.length}</td></tr>)}</tbody></table></div>{sessions.length === 0 && <p className="muted">Esta formación todavía no tiene sesiones.</p>}{sessions.length > 0 && visibleSessions.length === 0 && <p className="muted">No hay sesiones con ese estado.</p>}</section>
    <ConfirmActionDialog
      open={confirmClose}
      title="Cerrar formación"
      description="La formación quedará cerrada documentalmente. Se registrarán usuario y fecha, sin modificar el estado de ejecución de las sesiones."
      confirmLabel="Cerrar formación"
      tone="primary"
      busy={closureBusy}
      onCancel={() => setConfirmClose(false)}
      onConfirm={closeTraining}
    />
    <ConfirmActionDialog
      open={confirmReopen}
      title="Reabrir formación"
      description="La formación volverá a estar abierta documentalmente. El motivo y el usuario quedarán registrados en auditoría."
      confirmLabel="Reabrir formación"
      tone="primary"
      busy={closureBusy}
      onCancel={() => setConfirmReopen(false)}
      onConfirm={reopenTraining}
    />
  </>;
}
