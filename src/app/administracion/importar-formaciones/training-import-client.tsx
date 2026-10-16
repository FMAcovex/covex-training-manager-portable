"use client";

import { useState } from "react";
import type { TrainingImportMappings, TrainingImportPreview, TrainingImportResult } from "@/imports/training-import-types";

const emptyMappings: TrainingImportMappings = { trainingTypes: {}, modalities: {}, departments: {}, trainingDepartments: {}, sourcePeople: {}, trainers: {}, attendees: {}, dateOverrides: {}, attendanceResults: {} };

export default function TrainingImportClient() {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<TrainingImportPreview>();
  const [mappings, setMappings] = useState<TrainingImportMappings>(emptyMappings);
  const [result, setResult] = useState<TrainingImportResult>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(action: "preview" | "commit", nextMappings = mappings) {
    if (!file) return setError("Selecciona primero la plantilla .xlsx.");
    setBusy(true); setError(""); setResult(undefined);
    try {
      const body = new FormData();
      body.set("file", file); body.set("action", action); body.set("mappings", JSON.stringify(nextMappings));
      const response = await fetch("/api/admin/training-import", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        if (data.preview) { setPreview(data.preview); setMappings(data.preview.suggestedMappings); }
        throw new Error(data.error ?? "No se pudo procesar el archivo");
      }
      if (action === "preview") { setPreview(data); setMappings(data.suggestedMappings); }
      else { setResult(data); setPreview(undefined); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo procesar el archivo"); }
    finally { setBusy(false); }
  }

  const updateRecord = (section: "trainingTypes" | "modalities" | "departments" | "sourcePeople" | "trainers" | "attendees" | "attendanceResults", key: string, value: string) => setMappings((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  const updateDate = (sessionId: string, field: "plannedDate" | "executionDate", value: string) => setMappings((current) => ({ ...current, dateOverrides: { ...current.dateOverrides, [sessionId]: { ...current.dateOverrides[sessionId], [field]: value } } }));
  const updateTrainingDepartments = (key: string, values: string[]) => setMappings((current) => ({ ...current, trainingDepartments: { ...current.trainingDepartments, [key]: [...new Set(values)] } }));

  if (result) return <section className="card import-complete"><span className="status-badge status-executed">Importación completada</span><h2>Los datos de 2026 ya están disponibles</h2><p>Se han incorporado {result.counts.trainings} formaciones, {result.counts.sessions} sesiones y {result.counts.attendances} registros de asistencia.</p><button type="button" onClick={() => { setFile(undefined); setMappings(emptyMappings); setResult(undefined); }}>Importar otro archivo</button></section>;

  return <div className="import-layout">
    <section className="card form-section import-upload">
      <div className="form-section-heading"><div><h2>1. Selecciona la plantilla</h2><p>El archivo se analiza en memoria y no se conserva.</p></div></div>
      <div className="form-grid">
        <label className="full-width">Archivo Excel
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(event) => { const selected = event.target.files?.[0]; setFile(selected); setPreview(undefined); setError(""); }} />
          <span className="field-help">Formato esperado: hojas Personal, Sesiones y Asistencia de la plantilla 2026. Máximo 10 MB.</span>
        </label>
        <div className="form-actions"><button type="button" disabled={!file || busy} onClick={() => void submit("preview", emptyMappings)}>{busy ? "Analizando…" : "Analizar archivo"}</button></div>
      </div>
    </section>

    {error && <div className="form-alert form-alert-error" role="alert"><strong>No se pudo completar la operación</strong><span>{error}</span></div>}

    {preview && <>
      <section className="summary-grid import-summary" aria-label="Resumen de importación">
        <div className="summary-card"><strong>{preview.counts.peopleToCreate}</strong><span>personas nuevas</span></div>
        <div className="summary-card"><strong>{preview.counts.trainings}</strong><span>formaciones</span></div>
        <div className="summary-card"><strong>{preview.counts.sessions}</strong><span>sesiones</span></div>
        <div className="summary-card"><strong>{preview.counts.attendances}</strong><span>asistencias</span></div>
        <div className="summary-card"><strong>{preview.counts.executedSessions}</strong><span>sesiones ejecutadas</span></div>
      </section>

      <section className="card form-section">
        <div className="form-section-heading"><div><h2>2. Revisa las correspondencias</h2><p>Los valores de la plantilla deben vincularse con catálogos y personas de la aplicación.</p></div></div>
        <div className="mapping-grid">
          {preview.sourceValues.trainingTypes.map((value) => <MappingSelect key={`type-${value}`} label={`Tipo: ${value}`} value={mappings.trainingTypes[value] ?? ""} options={preview.options.trainingTypes.map((item) => ({ value: item.id, label: `${item.name} (${item.code})` }))} onChange={(next) => updateRecord("trainingTypes", value, next)} />)}
          {preview.sourceValues.modalities.map((value) => <MappingSelect key={`mod-${value}`} label={`Modalidad: ${value}`} value={mappings.modalities[value] ?? ""} options={preview.options.modalities.map((item) => ({ value: item.id, label: `${item.name} (${item.code})` }))} onChange={(next) => updateRecord("modalities", value, next)} />)}
          {preview.sourceValues.departments.map((value) => <MappingSelect key={`dep-${value}`} label={`Departamento: ${value}`} value={mappings.departments[value] ?? ""} options={preview.options.departments.map((item) => ({ value: item.id, label: `${item.name} (${item.code})` }))} onChange={(next) => updateRecord("departments", value, next)} />)}
        </div>
        <details className="import-details" open><summary>Departamentos destinatarios por formación ({preview.sourceValues.trainingDepartments.length})</summary><div className="mapping-grid">
          {preview.sourceValues.trainingDepartments.map((training) => <label key={training.key}>{training.label}
            <select multiple value={mappings.trainingDepartments[training.key] ?? []} onChange={(event) => updateTrainingDepartments(training.key, Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
              {preview.options.departments.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
            </select>
            <span className="field-help">{training.sourceDepartments.length ? `Departamentos observados en la asistencia: ${training.sourceDepartments.join(", ")}` : "Sin departamento inferible; puedes seleccionar ninguno, uno o varios."}</span>
          </label>)}
        </div></details>
        <details className="import-details"><summary>Revisar las {preview.sourceValues.sourcePeople.length} personas de la plantilla</summary><div className="mapping-grid">
          {preview.sourceValues.sourcePeople.map((person) => <MappingSelect key={person.key} label={person.label} value={mappings.sourcePeople[person.key] ?? ""} options={[{ value: `source:${person.key}`, label: "Crear como persona nueva" }, ...preview.options.people.filter((item) => item.key.startsWith("existing:")).map((item) => ({ value: item.key, label: item.label }))]} onChange={(next) => updateRecord("sourcePeople", person.key, next)} />)}
        </div></details>
        <details className="import-details" open={preview.sourceValues.trainers.some((name) => !mappings.trainers[name])}><summary>Asignar formadores internos ({preview.sourceValues.trainers.length})</summary><div className="mapping-grid">
          {preview.sourceValues.trainers.map((name) => <MappingSelect key={name} label={name} value={mappings.trainers[name] ?? ""} options={preview.options.people.filter((item) => item.personType === "INTERNAL").map((item) => ({ value: item.key, label: item.label }))} onChange={(next) => updateRecord("trainers", name, next)} />)}
        </div></details>
        {preview.sourceValues.unresolvedAttendees.length > 0 && <details className="import-details" open><summary>Resolver asistentes sin coincidencia ({preview.sourceValues.unresolvedAttendees.length})</summary><div className="mapping-grid">
          {preview.sourceValues.unresolvedAttendees.map((name) => <MappingSelect key={name} label={name} value={mappings.attendees[name] ?? ""} options={preview.options.people.map((item) => ({ value: item.key, label: item.label }))} onChange={(next) => updateRecord("attendees", name, next)} />)}
        </div></details>}
      </section>

      {(preview.sourceValues.ambiguousDates.length > 0 || preview.sourceValues.invalidAttendanceResults.length > 0) && <section className="card form-section">
        <div className="form-section-heading"><div><h2>3. Resuelve los datos ambiguos</h2><p>No se inventan fechas ni resultados durante la migración.</p></div></div>
        <div className="mapping-grid">
          {preview.sourceValues.ambiguousDates.map((item) => <label key={`${item.sessionId}-${item.field}`}>Sesión {item.sessionId}: {item.field === "plannedDate" ? "fecha prevista" : "fecha de ejecución"}<input type="date" value={mappings.dateOverrides[item.sessionId]?.[item.field] ?? ""} onChange={(event) => updateDate(item.sessionId, item.field, event.target.value)} /><span className="field-help">Valor original: {item.rawValue}</span></label>)}
          {preview.sourceValues.invalidAttendanceResults.map((item) => <MappingSelect key={item.key} label={`${item.sessionId} · ${item.attendee} (original: ${item.rawValue})`} value={mappings.attendanceResults[item.key] ?? ""} options={[{ value: "PASS", label: "Apto" }, { value: "FAIL", label: "No apto" }, { value: "NOT_APPLICABLE", label: "No aplica" }]} onChange={(next) => updateRecord("attendanceResults", item.key, next)} />)}
        </div>
      </section>}

      <section className="card import-validation">
        <div><h2>{preview.canCommit ? "Previsualización validada" : "Validación pendiente"}</h2><p className="muted">{preview.issues.filter((item) => item.severity === "ERROR").length} errores · {preview.issues.filter((item) => item.severity === "WARNING").length} avisos</p></div>
        {preview.issues.length > 0 && <ul className="issue-list">{preview.issues.map((issue, index) => <li className={issue.severity === "ERROR" ? "issue-error" : "issue-warning"} key={`${issue.code}-${issue.key ?? index}`}>{issue.message}</li>)}</ul>}
        <div className="button-row"><button className="secondary" type="button" disabled={busy} onClick={() => void submit("preview")}>{busy ? "Validando…" : "Validar cambios"}</button><button type="button" disabled={busy || !preview.canCommit} onClick={() => void submit("commit")}>{busy ? "Importando…" : "Confirmar importación"}</button></div>
      </section>
    </>}
  </div>;
}

function MappingSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Seleccionar…</option>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
}
