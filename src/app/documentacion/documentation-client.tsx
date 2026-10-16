"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DocumentControlEvidence } from "@/app/components/document-control-evidence";
import { formatDateEs, formatDateTimeEs } from "@/app/lib/format";
import { ApiClientError, apiJson } from "@/app/lib/api-client";
import type { DocumentControlAttachmentMeta, DocumentationRow } from "@/document-control/types";

export default function DocumentationClient() {
  const [rows, setRows] = useState<DocumentationRow[]>([]);
  const [status, setStatus] = useState("ALL");
  const [openReason, setOpenReason] = useState<string>();
  const [year, setYear] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string>();

  const load = useCallback(async () => {
    const query = new URLSearchParams({ status });
    if (year) query.set("year", year);
    if (search.trim()) query.set("search", search.trim());
    try {
      setRows(await apiJson<DocumentationRow[]>(`/api/documentation?${query}`));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof ApiClientError ? loadError.message : "No se pudo cargar la documentación");
    }
  }, [search, status, year]);

  useEffect(() => { void load(); }, [load]);

  function setFlag(sessionId: string, field: "signedAnnexIII" | "trainingMaterialArchived" | "evaluationEvidenceArchived" | "dossierPrinted", value: boolean) {
    setRows((items) => items.map((row) => {
      if (row.sessionId !== sessionId) return row;
      const next = { ...row, [field]: value };
      if (value && field === "signedAnnexIII") next.signedAnnexIIIReason = undefined;
      if (value && field === "trainingMaterialArchived") next.trainingMaterialReason = undefined;
      if (value && field === "evaluationEvidenceArchived") next.evaluationEvidenceReason = undefined;
      return next;
    }));
  }
  function setReason(sessionId: string, field: "signedAnnexIIIReason" | "trainingMaterialReason" | "evaluationEvidenceReason", value: string) {
    setRows((items) => items.map((row) => row.sessionId === sessionId ? { ...row, [field]: value } : row));
  }

  function setAttachments(sessionId: string, attachments: DocumentControlAttachmentMeta[]) {
    setRows((items) => items.map((row) => row.sessionId === sessionId ? { ...row, attachments } : row));
  }

  async function save(row: DocumentationRow) {
    setSaving(row.sessionId); setError("");
    try {
      await apiJson(`/api/sessions/${row.sessionId}/document-control`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedAnnexIII: row.signedAnnexIII, trainingMaterialArchived: row.trainingMaterialArchived, evaluationEvidenceArchived: row.evaluationEvidenceArchived, dossierPrinted: row.dossierPrinted, signedAnnexIIIReason: row.signedAnnexIIIReason, trainingMaterialReason: row.trainingMaterialReason, evaluationEvidenceReason: row.evaluationEvidenceReason }),
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof ApiClientError ? saveError.message : "No se pudo guardar el control documental");
    } finally { setSaving(undefined); }
  }

  return <>
    <section className="card"><div className="filter-grid">
      <label>Año<input type="number" min="1000" max="9999" value={year} onChange={(event) => setYear(event.target.value)} placeholder="Todos" /></label>
      <label>Seguimiento documental<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">Todos</option><option value="PRINT_PENDING">Pendiente de impresión</option><option value="DOCUMENTATION_PENDING">Pendiente de documentación</option><option value="CONFORMING">Conforme</option></select></label>
      <label>Búsqueda<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Formación o código" /></label>
    </div>{error && <p className="error" role="alert">{error}</p>}</section>
    <section className="card table-card documentation-table-card"><div className="table-scroll"><table className="documentation-table responsive-record-table"><colgroup><col className="doc-col-training" /><col className="doc-col-session" /><col className="doc-col-date" /><col className="doc-col-print" /><col className="doc-col-control" /><col className="doc-col-control" /><col className="doc-col-control" /><col className="doc-col-followup" /><col className="doc-col-actions" /></colgroup><thead><tr><th>Formación</th><th>Sesión</th><th>Fecha ejecución</th><th>Impreso</th><th>Anexo III firmado</th><th>Material archivado</th><th>Evaluaciones archivadas</th><th>Seguimiento</th><th>Acciones</th></tr></thead><tbody>
      {rows.map((row) => <tr key={row.sessionId}><td data-label="Formación">{row.trainingName}<br /><small>{row.trainingCode}</small></td><td data-label="Sesión">{row.sessionCode}</td><td data-label="Fecha ejecución">{formatDateEs(row.executionDate)}</td>
        <td data-label="Impreso"><label className="check-row documentation-print-check"><input aria-label={`Impreso ${row.sessionCode}`} type="checkbox" checked={row.dossierPrinted} onChange={(event) => setFlag(row.sessionId, "dossierPrinted", event.target.checked)} />Impreso</label></td>
        <td data-label="Anexo III firmado"><div className="document-control-cell"><label className="check-row"><input aria-label={`Anexo III ${row.sessionCode}`} type="checkbox" checked={row.signedAnnexIII} onChange={(event) => setFlag(row.sessionId, "signedAnnexIII", event.target.checked)} />Confirmado</label>{!row.signedAnnexIII && <div className="documentation-reason">
    {row.signedAnnexIIIReason && openReason !== `${row.sessionId}:signedAnnexIIIReason` && <small title={row.signedAnnexIIIReason}>{row.signedAnnexIIIReason}</small>}
    {openReason === `${row.sessionId}:signedAnnexIIIReason` ? <>
      <textarea aria-label={`Motivo Anexo III ${row.sessionCode}`} placeholder="Indica el motivo" value={row.signedAnnexIIIReason ?? ""} onChange={(event) => setReason(row.sessionId, "signedAnnexIIIReason", event.target.value)} />
      <button type="button" className="text-action" onClick={() => setOpenReason(undefined)}>Cerrar motivo</button>
    </> : <button type="button" className="text-action" onClick={() => setOpenReason(`${row.sessionId}:signedAnnexIIIReason`)}>{row.signedAnnexIIIReason ? "Editar motivo" : "Justificar"}</button>}
  </div>}<DocumentControlEvidence sessionId={row.sessionId} category="SIGNED_ANNEX_III" attachments={row.attachments} canManage compact onAttachmentsChange={(attachments) => setAttachments(row.sessionId, attachments)} /></div></td>
        <td data-label="Material archivado"><div className="document-control-cell"><label className="check-row"><input aria-label={`Material ${row.sessionCode}`} type="checkbox" checked={row.trainingMaterialArchived} onChange={(event) => setFlag(row.sessionId, "trainingMaterialArchived", event.target.checked)} />Confirmado</label>{!row.trainingMaterialArchived && <div className="documentation-reason">
    {row.trainingMaterialReason && openReason !== `${row.sessionId}:trainingMaterialReason` && <small title={row.trainingMaterialReason}>{row.trainingMaterialReason}</small>}
    {openReason === `${row.sessionId}:trainingMaterialReason` ? <>
      <textarea aria-label={`Motivo material ${row.sessionCode}`} placeholder="Indica el motivo" value={row.trainingMaterialReason ?? ""} onChange={(event) => setReason(row.sessionId, "trainingMaterialReason", event.target.value)} />
      <button type="button" className="text-action" onClick={() => setOpenReason(undefined)}>Cerrar motivo</button>
    </> : <button type="button" className="text-action" onClick={() => setOpenReason(`${row.sessionId}:trainingMaterialReason`)}>{row.trainingMaterialReason ? "Editar motivo" : "Justificar"}</button>}
  </div>}<DocumentControlEvidence sessionId={row.sessionId} category="TRAINING_MATERIAL" attachments={row.attachments} canManage compact onAttachmentsChange={(attachments) => setAttachments(row.sessionId, attachments)} /></div></td>
        <td data-label="Evaluaciones archivadas"><div className="document-control-cell"><label className="check-row"><input aria-label={`Evaluaciones ${row.sessionCode}`} type="checkbox" checked={row.evaluationEvidenceArchived} onChange={(event) => setFlag(row.sessionId, "evaluationEvidenceArchived", event.target.checked)} />Confirmado</label>{!row.evaluationEvidenceArchived && <div className="documentation-reason">
    {row.evaluationEvidenceReason && openReason !== `${row.sessionId}:evaluationEvidenceReason` && <small title={row.evaluationEvidenceReason}>{row.evaluationEvidenceReason}</small>}
    {openReason === `${row.sessionId}:evaluationEvidenceReason` ? <>
      <textarea aria-label={`Motivo evaluaciones ${row.sessionCode}`} placeholder="Indica el motivo" value={row.evaluationEvidenceReason ?? ""} onChange={(event) => setReason(row.sessionId, "evaluationEvidenceReason", event.target.value)} />
      <button type="button" className="text-action" onClick={() => setOpenReason(undefined)}>Cerrar motivo</button>
    </> : <button type="button" className="text-action" onClick={() => setOpenReason(`${row.sessionId}:evaluationEvidenceReason`)}>{row.evaluationEvidenceReason ? "Editar motivo" : "Justificar"}</button>}
  </div>}<DocumentControlEvidence sessionId={row.sessionId} category="EVALUATION_EVIDENCE" attachments={row.attachments} canManage compact onAttachmentsChange={(attachments) => setAttachments(row.sessionId, attachments)} /></div></td>
        <td data-label="Seguimiento"><div className="documentation-followup"><span className={`badge status-document-${row.documentStatus.toLowerCase()}`}>{row.documentStatus === "CONFORMING" ? "Conforme" : row.documentStatus === "DOCUMENTATION_PENDING" ? "Documentación pendiente" : "Impresión pendiente"}</span>{row.updatedAt ? <small>Actualizado {formatDateTimeEs(row.updatedAt)}</small> : <small>Sin actualizar</small>}</div></td>
        <td data-label="Acciones"><div className="button-row documentation-actions"><button disabled={saving === row.sessionId} onClick={() => save(row)}>{saving === row.sessionId ? "Guardando…" : "Guardar"}</button><Link className="text-link" href={`/sesiones/${row.sessionId}`}>Ver sesión</Link></div></td></tr>)}
    </tbody></table></div>{rows.length === 0 && <p className="muted">No hay sesiones ejecutadas para los filtros seleccionados.</p>}</section>
  </>;
}
