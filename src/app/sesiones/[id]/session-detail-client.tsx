"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui";
import { formatDateEs } from "@/app/lib/format";
import { ConfirmActionDialog } from "@/app/components/confirm-action-dialog";
import { DocumentControlEvidence } from "@/app/components/document-control-evidence";
import type { Person } from "@/domain/person";
import type { AttendanceCompletion, TrainingSession } from "@/domain/training-session";
import type { Training } from "@/domain/training";
import type { DocumentControlAttachmentMeta, DocumentControlState } from "@/document-control/types";
import SessionForm from "../session-form";

const statusLabel = { PENDING: "Pendiente", EXECUTED: "Ejecutada", NOT_EXECUTED: "No ejecutada" } as const;
const attendanceLabel = { EXPECTED: "Previsto", ATTENDED: "Asiste", NOT_ATTENDED: "No asiste" } as const;
const resultLabel = { PENDING: "Pendiente", PASS: "Apto", FAIL: "No apto", NOT_APPLICABLE: "No aplicable" } as const;
export default function SessionDetailClient({ id, canEditPending, canEditClosed, canClose, canReopen, canReadDocumentControl, canUpdateDocumentControl }: { id: string; canEditPending: boolean; canEditClosed: boolean; canClose: boolean; canReopen: boolean; canReadDocumentControl: boolean; canUpdateDocumentControl: boolean }) {
  const [session, setSession] = useState<TrainingSession>(); const [training, setTraining] = useState<Training>(); const [people, setPeople] = useState<Person[]>([]);
  const [editing, setEditing] = useState(false); const [closing, setClosing] = useState(false); const [executionDate, setExecutionDate] = useState("");
  const [completions, setCompletions] = useState<AttendanceCompletion[]>([]); const [reason, setReason] = useState(""); const [error, setError] = useState("");
  const [generatingAnnex, setGeneratingAnnex] = useState(false); const [annexError, setAnnexError] = useState("");
  const [documentControl, setDocumentControl] = useState<DocumentControlState>(); const [documentError, setDocumentError] = useState(""); const [savingDocument, setSavingDocument] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [confirmNotExecuted, setConfirmNotExecuted] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [criticalBusy, setCriticalBusy] = useState(false);
  const load = useCallback(async () => { const response = await fetch(`/api/sessions/${id}`); if (!response.ok) { const result = await response.json().catch(() => ({})); setLoadError(result.error ?? "No se pudo cargar la sesión"); return; } setLoadError(""); const loaded: TrainingSession = await response.json(); setSession(loaded); setCompletions(loaded.attendances.map((item) => ({ personId: item.personId, attendanceStatus: item.attendanceStatus === "NOT_ATTENDED" ? "NOT_ATTENDED" : "ATTENDED", result: item.attendanceStatus === "NOT_ATTENDED" ? "NOT_APPLICABLE" : item.result === "FAIL" ? "FAIL" : "PASS", notes: item.notes }))); setTraining(await fetch(`/api/trainings/${loaded.trainingId}`).then((r) => r.json())); if (canReadDocumentControl && loaded.executionStatus === "EXECUTED") { const controlResponse = await fetch(`/api/sessions/${id}/document-control`); const controlResult = await controlResponse.json(); if (controlResponse.ok) { setDocumentControl(controlResult); setDocumentError(""); } else setDocumentError(controlResult.error ?? "No se pudo cargar el control documental"); } else setDocumentControl(undefined); }, [canReadDocumentControl, id]);
  useEffect(() => { void Promise.all([load(), fetch("/api/people").then((r) => r.json()).then(setPeople)]); }, [load]);
  if (loadError) return <><h1>No se pudo cargar la sesión</h1><p className="error">{loadError}</p><Link className="text-link" href="/formaciones">Volver a Formaciones</Link></>;
  if (!session || !training) return <p>Cargando sesión…</p>;
  const personName = (personId: string) => people.find((person) => person.id === personId)?.fullName ?? personId;
  const internalTrainerIds = session.trainerPersonIds?.length ? session.trainerPersonIds : session.trainerPersonId ? [session.trainerPersonId] : [];
  const externalTrainerNames = session.externalTrainerNames?.length ? session.externalTrainerNames : session.externalTrainerName ? [session.externalTrainerName] : [];
  const trainer = [...internalTrainerIds.map(personName).filter(Boolean), ...externalTrainerNames].join(", ");
  const updateCompletion = (personId: string, changes: Partial<AttendanceCompletion>) => setCompletions((items) => items.map((item) => item.personId === personId ? { ...item, ...changes } : item));
  function requestFinalize(event: FormEvent) { event.preventDefault(); setError(""); if (!executionDate) { setError("La fecha de ejecución es obligatoria"); return; } setConfirmFinalize(true); }
  async function finalize() {
    setCriticalBusy(true); setError("");
    const response = await fetch(`/api/sessions/${id}/finalize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ executionDate, initializeDefaults: false, attendances: completions }) });
    const result = await response.json().catch(() => ({})); setCriticalBusy(false);
    if (!response.ok) { setConfirmFinalize(false); setError(result.error ?? "No se ha podido finalizar la sesión"); return; }
    setConfirmFinalize(false); setClosing(false); await load();
  }
  function requestNotExecuted() { setError(""); if (!reason.trim()) { setError("El motivo de no ejecución es obligatorio"); return; } setConfirmNotExecuted(true); }
  async function notExecuted() {
    setCriticalBusy(true); setError("");
    const response = await fetch(`/api/sessions/${id}/not-executed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    const result = await response.json().catch(() => ({})); setCriticalBusy(false);
    if (!response.ok) { setConfirmNotExecuted(false); setError(result.error ?? "No se ha podido marcar la sesión como no ejecutada"); return; }
    setConfirmNotExecuted(false); await load();
  }
  async function generateAnnexIII() {
    if (generatingAnnex || !session || session.executionStatus === "NOT_EXECUTED") return;
    const sessionCode = session.code;
    setGeneratingAnnex(true); setAnnexError("");
    try {
      const response = await fetch(`/api/sessions/${id}/annex-iii`, { method: "POST" });
      if (!response.ok) { const result = await response.json(); setAnnexError(result.error ?? "No se pudo generar el Anexo III"); return; }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `Anexo_III_${sessionCode}.pdf`;
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch { setAnnexError("No se pudo descargar el Anexo III"); }
    finally { setGeneratingAnnex(false); }
  }
  function updateDocumentFlag(field: "signedAnnexIII" | "trainingMaterialArchived" | "evaluationEvidenceArchived" | "dossierPrinted", value: boolean) {
    setDocumentControl((current) => {
      if (!current) return current;
      const next = { ...current, [field]: value };
      if (value && field === "signedAnnexIII") next.signedAnnexIIIReason = undefined;
      if (value && field === "trainingMaterialArchived") next.trainingMaterialReason = undefined;
      if (value && field === "evaluationEvidenceArchived") next.evaluationEvidenceReason = undefined;
      return next;
    });
  }
  function updateDocumentReason(field: "signedAnnexIIIReason" | "trainingMaterialReason" | "evaluationEvidenceReason", value: string) { setDocumentControl((current) => current ? { ...current, [field]: value } : current); }
  function updateDocumentAttachments(attachments: DocumentControlAttachmentMeta[]) { setDocumentControl((current) => current ? { ...current, attachments } : current); }
  async function saveDocumentControl() {
    if (!documentControl || savingDocument || !canUpdateDocumentControl) return;
    setSavingDocument(true); setDocumentError("");
    const response = await fetch(`/api/sessions/${id}/document-control`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedAnnexIII: documentControl.signedAnnexIII, trainingMaterialArchived: documentControl.trainingMaterialArchived, evaluationEvidenceArchived: documentControl.evaluationEvidenceArchived, dossierPrinted: documentControl.dossierPrinted, signedAnnexIIIReason: documentControl.signedAnnexIIIReason, trainingMaterialReason: documentControl.trainingMaterialReason, evaluationEvidenceReason: documentControl.evaluationEvidenceReason }) });
    const result = await response.json(); setSavingDocument(false);
    if (!response.ok) { setDocumentError(result.error ?? "No se pudo guardar el control documental"); return; }
    setDocumentControl(result);
  }
  async function reopenSession() {
    if (!reopenReason.trim()) { setError("El motivo de reapertura es obligatorio"); return; }
    setCriticalBusy(true); setError("");
    const response = await fetch(`/api/sessions/${id}/reopen`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reopenReason }) });
    const result = await response.json().catch(() => ({})); setCriticalBusy(false);
    if (!response.ok) { setConfirmReopen(false); setError(result.error ?? "No se ha podido reabrir la sesión"); return; }
    setConfirmReopen(false); setReopenReason(""); setEditing(false); await load();
  }
  const documentStatusLabel = documentControl?.documentStatus === "CONFORMING" ? "Conforme" : documentControl?.documentStatus === "DOCUMENTATION_PENDING" ? "Documentación pendiente" : "Impresión pendiente";

  return <><PageHeader title={session.code} description={training.name} action={<div className="button-row"><Link className="button-link secondary-link" href={`/formaciones/${training.id}`}>Volver</Link>{((session.executionStatus === "PENDING" && canEditPending) || (session.executionStatus !== "PENDING" && canEditClosed)) && <button onClick={() => setEditing((value) => !value)}>{editing ? "Cerrar edición" : "Editar"}</button>}</div>} />
    {editing ? <section className="card"><h2>Corregir sesión</h2><SessionForm training={training} initial={session} onSaved={(updated) => { setSession(updated); setEditing(false); }} /></section> : <section className="card"><h2>Datos de sesión</h2><dl className="details-grid"><div><dt>Estado</dt><dd><span className={`badge status-${session.executionStatus.toLowerCase()}`}>{statusLabel[session.executionStatus]}</span></dd></div><div><dt>Formación</dt><dd><Link className="text-link" href={`/formaciones/${training.id}`}>{training.code} · {training.name}</Link></dd></div><div><dt>Fecha prevista</dt><dd>{formatDateEs(session.plannedDate)}</dd></div><div><dt>Fecha de ejecución</dt><dd>{formatDateEs(session.executionDate)}</dd></div><div><dt>Formadores</dt><dd>{trainer || "—"}</dd></div><div><dt>Duración</dt><dd>{session.durationMinutes} minutos</dd></div>{session.nonExecutionReason && <div className="full-width"><dt>Motivo de no ejecución</dt><dd>{session.nonExecutionReason}</dd></div>}<div className="full-width"><dt>Observaciones</dt><dd>{session.notes ?? "—"}</dd></div></dl></section>}
    <section className="card table-card"><h2>Asistentes</h2><div className="table-scroll"><table><thead><tr><th>Persona</th><th>Asistencia</th><th>Resultado</th><th>Observaciones</th></tr></thead><tbody>{session.attendances.map((item) => <tr key={item.id}><td>{personName(item.personId)}</td><td>{attendanceLabel[item.attendanceStatus]}</td><td>{resultLabel[item.result]}</td><td>{item.notes ?? "—"}</td></tr>)}</tbody></table></div></section>
    {session.executionStatus === "PENDING" && canClose && <section className="card"><div className="toolbar"><h2>Finalizar sesión</h2><button className="secondary" onClick={() => setClosing((value) => !value)}>{closing ? "Cancelar" : "Preparar cierre"}</button></div>{closing && <form className="form-grid" onSubmit={requestFinalize}><label>Fecha de ejecución *<input type="date" value={executionDate} onChange={(e) => setExecutionDate(e.target.value)} /></label><div className="full-width table-scroll"><table><thead><tr><th>Persona</th><th>Asistencia</th><th>Resultado</th><th>Observaciones</th></tr></thead><tbody>{completions.map((item) => <tr key={item.personId}><td>{personName(item.personId)}</td><td><select value={item.attendanceStatus} onChange={(e) => { const value = e.target.value as AttendanceCompletion["attendanceStatus"]; updateCompletion(item.personId, { attendanceStatus: value, result: value === "NOT_ATTENDED" ? "NOT_APPLICABLE" : "PASS" }); }}><option value="ATTENDED">Asiste</option><option value="NOT_ATTENDED">No asiste</option></select></td><td><select disabled={item.attendanceStatus === "NOT_ATTENDED"} value={item.result} onChange={(e) => updateCompletion(item.personId, { result: e.target.value as AttendanceCompletion["result"] })}><option value="PASS">Apto</option><option value="FAIL">No apto</option><option value="NOT_APPLICABLE">No aplicable</option></select></td><td><input value={item.notes ?? ""} onChange={(e) => updateCompletion(item.personId, { notes: e.target.value })} /></td></tr>)}</tbody></table></div><div className="form-actions"><button>Guardar y finalizar</button></div></form>}<div className="non-execution"><label>Motivo para marcar no ejecutada<input value={reason} onChange={(e) => setReason(e.target.value)} /></label><button className="danger" type="button" onClick={requestNotExecuted}>Marcar no ejecutada</button></div>{error && <p className="error" role="alert">{error}</p>}</section>}
    {session.executionStatus === "EXECUTED" && canReadDocumentControl && <section className="card"><div className="toolbar"><div><h2>Control documental</h2><p className="muted">La impresión es obligatoria para el cierre. Los demás controles pueden quedar sin marcar si se indica el motivo.</p></div>{documentControl && <span className={`badge status-document-${documentControl.documentStatus.toLowerCase()}`}>{documentStatusLabel}</span>}</div>{documentControl && <div className="document-checks">
      <div className="document-check-item"><label className="check-row"><input type="checkbox" disabled={!canUpdateDocumentControl} checked={documentControl.dossierPrinted} onChange={(event) => updateDocumentFlag("dossierPrinted", event.target.checked)} />Expediente impreso</label><p className="muted">Obligatorio para poder cerrar documentalmente la formación.</p></div>
      <div className="document-check-item"><label className="check-row"><input type="checkbox" disabled={!canUpdateDocumentControl} checked={documentControl.signedAnnexIII} onChange={(event) => updateDocumentFlag("signedAnnexIII", event.target.checked)} />Anexo III firmado</label>{!documentControl.signedAnnexIII && <label>Motivo si no se marca<textarea disabled={!canUpdateDocumentControl} value={documentControl.signedAnnexIIIReason ?? ""} onChange={(event) => updateDocumentReason("signedAnnexIIIReason", event.target.value)} /></label>}<DocumentControlEvidence sessionId={session.id} category="SIGNED_ANNEX_III" attachments={documentControl.attachments} canManage={canUpdateDocumentControl} onAttachmentsChange={updateDocumentAttachments} /></div>
      <div className="document-check-item"><label className="check-row"><input type="checkbox" disabled={!canUpdateDocumentControl} checked={documentControl.trainingMaterialArchived} onChange={(event) => updateDocumentFlag("trainingMaterialArchived", event.target.checked)} />Contenido/material archivado</label>{!documentControl.trainingMaterialArchived && <label>Motivo si no se marca<textarea disabled={!canUpdateDocumentControl} value={documentControl.trainingMaterialReason ?? ""} onChange={(event) => updateDocumentReason("trainingMaterialReason", event.target.value)} /></label>}<DocumentControlEvidence sessionId={session.id} category="TRAINING_MATERIAL" attachments={documentControl.attachments} canManage={canUpdateDocumentControl} onAttachmentsChange={updateDocumentAttachments} /></div>
      <div className="document-check-item"><label className="check-row"><input type="checkbox" disabled={!canUpdateDocumentControl} checked={documentControl.evaluationEvidenceArchived} onChange={(event) => updateDocumentFlag("evaluationEvidenceArchived", event.target.checked)} />Evaluaciones/exámenes archivados</label>{!documentControl.evaluationEvidenceArchived && <label>Motivo si no se marca<textarea disabled={!canUpdateDocumentControl} value={documentControl.evaluationEvidenceReason ?? ""} onChange={(event) => updateDocumentReason("evaluationEvidenceReason", event.target.value)} /></label>}<DocumentControlEvidence sessionId={session.id} category="EVALUATION_EVIDENCE" attachments={documentControl.attachments} canManage={canUpdateDocumentControl} onAttachmentsChange={updateDocumentAttachments} /></div>
    </div>}{canUpdateDocumentControl && documentControl && <button disabled={savingDocument} onClick={saveDocumentControl}>{savingDocument ? "Guardando…" : "Guardar control documental"}</button>}{documentError && <p className="error" role="alert">{documentError}</p>}</section>}
    {session.executionStatus !== "EXECUTED" && <section className="card"><h2>Control documental</h2><p className="muted">No aplica hasta que la sesión esté ejecutada.</p></section>}
    {session.executionStatus !== "PENDING" && canReopen && <section className="card"><h2>Reabrir sesión</h2><p className="muted">La sesión volverá a Pendiente. La ejecución anterior quedará registrada en auditoría y los controles documentales deberán revisarse de nuevo tras la siguiente ejecución.</p><label>Motivo de reapertura *<textarea value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} /></label><div className="form-actions"><button className="secondary" type="button" disabled={!reopenReason.trim()} onClick={() => setConfirmReopen(true)}>Reabrir sesión</button></div></section>}
    <ConfirmActionDialog
      open={confirmFinalize}
      title="Finalizar sesión"
      description="La sesión pasará a Ejecutada y se registrarán la fecha, asistencias y resultados indicados. Confirma solo cuando los datos sean definitivos."
      confirmLabel="Finalizar sesión"
      tone="primary"
      busy={criticalBusy}
      onCancel={() => setConfirmFinalize(false)}
      onConfirm={finalize}
    />
    <ConfirmActionDialog
      open={confirmNotExecuted}
      title="Marcar sesión como no ejecutada"
      description="La sesión quedará cerrada como No ejecutada y se conservará el motivo indicado en el histórico."
      confirmLabel="Marcar no ejecutada"
      busy={criticalBusy}
      onCancel={() => setConfirmNotExecuted(false)}
      onConfirm={notExecuted}
    />
    <ConfirmActionDialog
      open={confirmReopen}
      title="Reabrir sesión"
      description="La sesión volverá a Pendiente. Se conservará la trazabilidad del estado anterior y será necesario finalizarla de nuevo."
      confirmLabel="Reabrir sesión"
      tone="primary"
      busy={criticalBusy}
      onCancel={() => setConfirmReopen(false)}
      onConfirm={reopenSession}
    />
    <section className="card"><div className="toolbar"><div><h2>Anexo III</h2><p className="muted">Registro de asistencia y evaluación de esta sesión.</p></div><button disabled={generatingAnnex || session.executionStatus === "NOT_EXECUTED"} onClick={generateAnnexIII}>{generatingAnnex ? "Generando…" : "Generar Anexo III"}</button></div>{session.executionStatus === "NOT_EXECUTED" && <p className="error">No procede generar un registro de asistencia de una sesión no ejecutada.</p>}{annexError && <p className="error" role="alert">{annexError}</p>}</section>
  </>;
}
