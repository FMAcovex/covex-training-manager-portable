"use client";

import { useState } from "react";
import type { TrainerImportMappings, TrainerImportPreview, TrainerImportResult } from "@/imports/trainer-import-types";

export default function TrainerImportClient() {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<TrainerImportPreview>();
  const [mappings, setMappings] = useState<TrainerImportMappings>({});
  const [result, setResult] = useState<TrainerImportResult>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(action: "preview" | "commit", nextMappings = mappings) {
    if (!file) { setError("Selecciona primero el Anexo III en formato .docx."); return; }
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.set("file", file); body.set("action", action); body.set("mappings", JSON.stringify(nextMappings));
      const response = await fetch("/api/admin/trainer-import", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        if (data.preview) { setPreview(data.preview); setMappings(data.preview.suggestedMappings); }
        throw new Error(data.error ?? "No se pudo procesar el documento");
      }
      if (action === "preview") { setPreview(data); setMappings(data.suggestedMappings); setResult(undefined); }
      else { setResult(data); setPreview(undefined); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo procesar el documento"); }
    finally { setBusy(false); }
  }

  function updateMapping(key: string, value: string) {
    const next = { ...mappings, [key]: value };
    setMappings(next);
  }

  if (result) return <section className="card import-complete"><span className="status-badge status-executed">Importación completada</span><h2>Listado incorporado</h2><p>Se han creado {result.imported} líneas de cualificación. Se han omitido {result.skippedExisting} que ya estaban registradas.</p><a className="button-link" href="/formadores">Abrir Formadores</a></section>;

  return <div className="import-layout">
    <section className="card form-section import-upload"><div className="form-section-heading"><div><h2>1. Selecciona el Anexo III</h2><p>El DOCX se analiza en memoria; el archivo fuente no se conserva.</p></div></div><div className="form-grid">
      <label className="full-width">Documento Word<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={(event) => { setFile(event.target.files?.[0]); setPreview(undefined); setMappings({}); setError(""); }} /><span className="field-help">Debe contener la tabla “LISTADO DE FORMADORES CUALIFICADOS” con las seis columnas del Anexo III.</span></label>
      <div className="form-actions"><button type="button" disabled={!file || busy} onClick={() => void submit("preview", {})}>{busy ? "Analizando…" : "Analizar documento"}</button></div>
    </div></section>

    {error && <div className="form-alert form-alert-error" role="alert"><strong>No se pudo completar la operación</strong><span>{error}</span></div>}

    {preview && <>
      <section className="summary-grid import-summary">
        <div className="summary-card"><strong>{preview.counts.rows}</strong><span>líneas detectadas</span></div>
        <div className="summary-card"><strong>{preview.counts.trainers}</strong><span>formadores</span></div>
        <div className="summary-card"><strong>{preview.counts.newQualifications}</strong><span>nuevas cualificaciones</span></div>
        <div className="summary-card"><strong>{preview.counts.alreadyRegistered}</strong><span>ya registradas</span></div>
      </section>
      <section className="card form-section"><div className="form-section-heading"><div><h2>2. Vincula cada nombre con Personal</h2><p>La importación no crea personas nuevas ni guarda datos personales en el repositorio.</p></div></div><div className="mapping-grid">
        {preview.sourceTrainers.map((source) => <label key={source.key}>{source.name} · {source.personType === "INTERNAL" ? "INTERNO" : "EXTERNO"}
          <select value={mappings[source.key] ?? ""} onChange={(event) => updateMapping(source.key, event.target.value)}><option value="">Seleccionar persona…</option>{preview.people.filter((person) => person.personType === source.personType).map((person) => <option key={person.id} value={person.id}>{person.fullName}{person.company ? ` · ${person.company}` : ""}</option>)}</select>
        </label>)}
      </div></section>
      <section className="card import-validation"><div><h2>{preview.canCommit ? "Previsualización validada" : "Validación pendiente"}</h2><p className="muted">{preview.issues.filter((item) => item.severity === "ERROR").length} errores · {preview.issues.filter((item) => item.severity === "WARNING").length} avisos</p></div>
        {preview.issues.length > 0 && <ul className="issue-list">{preview.issues.map((issue, index) => <li key={`${issue.code}-${index}`} className={issue.severity === "ERROR" ? "issue-error" : "issue-warning"}>{issue.message}</li>)}</ul>}
        <div className="button-row"><button className="secondary" disabled={busy} type="button" onClick={() => void submit("preview")}>{busy ? "Validando…" : "Validar correspondencias"}</button><button disabled={busy || !preview.canCommit} type="button" onClick={() => void submit("commit")}>{busy ? "Importando…" : "Confirmar importación"}</button></div>
      </section>
    </>}
  </div>;
}
