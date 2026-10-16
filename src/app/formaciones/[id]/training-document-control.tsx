"use client";

import { useCallback, useEffect, useState } from "react";
import { DocumentControlEvidence } from "@/app/components/document-control-evidence";
import { ApiClientError, apiJson } from "@/app/lib/api-client";
import { formatDateEs, formatDateTimeEs } from "@/app/lib/format";
import type { DocumentControlAttachmentMeta, DocumentationRow } from "@/document-control/types";

export default function TrainingDocumentControl({
  trainingId,
  canRead,
  canUpdate,
  onChanged,
}: {
  trainingId: string;
  canRead: boolean;
  canUpdate: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState<DocumentationRow[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string>();
  const [openReason, setOpenReason] = useState<string>();

  const load = useCallback(async () => {
    if (!canRead) return;
    try {
      const data = await apiJson<DocumentationRow[]>(`/api/documentation?status=ALL&trainingId=${encodeURIComponent(trainingId)}`);
      setRows(data);
      setError("");
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "No se pudo cargar el control documental");
    }
  }, [canRead, trainingId]);

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
    setSaving(row.sessionId);
    setError("");
    try {
      await apiJson(`/api/sessions/${row.sessionId}/document-control`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedAnnexIII: row.signedAnnexIII,
          trainingMaterialArchived: row.trainingMaterialArchived,
          evaluationEvidenceArchived: row.evaluationEvidenceArchived,
          dossierPrinted: row.dossierPrinted,
          signedAnnexIIIReason: row.signedAnnexIIIReason,
          trainingMaterialReason: row.trainingMaterialReason,
          evaluationEvidenceReason: row.evaluationEvidenceReason,
        }),
      });
      await load();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "No se pudo guardar el control documental");
    } finally {
      setSaving(undefined);
    }
  }

  if (!canRead) return null;

  const reasonEditor = (
    row: DocumentationRow,
    checked: boolean,
    reasonField: "signedAnnexIIIReason" | "trainingMaterialReason" | "evaluationEvidenceReason",
    label: string,
  ) => {
    if (checked) return null;
    const key = `${row.sessionId}:${reasonField}`;
    const reason = row[reasonField];
    return <div className="training-doc-reason">
      {reason && openReason !== key && <small title={reason}>{reason}</small>}
      {openReason === key ? <>
        <textarea
          aria-label={`Motivo ${label} ${row.sessionCode}`}
          placeholder="Indica el motivo"
          value={reason ?? ""}
          onChange={(event) => setReason(row.sessionId, reasonField, event.target.value)}
        />
        <button className="text-action" type="button" onClick={() => setOpenReason(undefined)}>Cerrar motivo</button>
      </> : <button className="text-action" type="button" onClick={() => setOpenReason(key)}>{reason ? "Editar motivo" : "Justificar"}</button>}
    </div>;
  };

  return <section className="card training-document-control">
    <div className="toolbar">
      <div>
        <h2>Control documental</h2>
        <p className="muted">Gestiona aquí la misma documentación que aparece en la pantalla Documentación. Los cambios quedan sincronizados.</p>
      </div>
    </div>

    {rows.length === 0 && <p className="muted">No hay sesiones ejecutadas con control documental aplicable.</p>}

    <div className="training-document-list">
      {rows.map((row) => <article className="training-document-row" key={row.sessionId}>
        <div className="training-document-row-heading">
          <div>
            <strong>{row.sessionCode}</strong>
            <small>Ejecutada {formatDateEs(row.executionDate)}</small>
          </div>
          <div className="documentation-followup">
            <span className={`badge status-document-${row.documentStatus.toLowerCase()}`}>
              {row.documentStatus === "CONFORMING" ? "Conforme" : row.documentStatus === "DOCUMENTATION_PENDING" ? "Documentación pendiente" : "Impresión pendiente"}
            </span>
            <small>{row.updatedAt ? `Actualizado ${formatDateTimeEs(row.updatedAt)}` : "Sin actualizar"}</small>
          </div>
        </div>

        <div className="training-document-grid">
          <div className="training-document-item">
            <label className="check-row"><input type="checkbox" disabled={!canUpdate} checked={Boolean(row.dossierPrinted)} onChange={(event) => setFlag(row.sessionId, "dossierPrinted", event.target.checked)} />Expediente impreso</label>
          </div>

          <div className="training-document-item">
            <label className="check-row"><input type="checkbox" disabled={!canUpdate} checked={row.signedAnnexIII} onChange={(event) => setFlag(row.sessionId, "signedAnnexIII", event.target.checked)} />Anexo III firmado</label>
            {reasonEditor(row, row.signedAnnexIII, "signedAnnexIIIReason", "Anexo III")}
            <DocumentControlEvidence sessionId={row.sessionId} category="SIGNED_ANNEX_III" attachments={row.attachments} canManage={canUpdate} compact onAttachmentsChange={(attachments) => setAttachments(row.sessionId, attachments)} />
          </div>

          <div className="training-document-item">
            <label className="check-row"><input type="checkbox" disabled={!canUpdate} checked={row.trainingMaterialArchived} onChange={(event) => setFlag(row.sessionId, "trainingMaterialArchived", event.target.checked)} />Material archivado</label>
            {reasonEditor(row, row.trainingMaterialArchived, "trainingMaterialReason", "material")}
            <DocumentControlEvidence sessionId={row.sessionId} category="TRAINING_MATERIAL" attachments={row.attachments} canManage={canUpdate} compact onAttachmentsChange={(attachments) => setAttachments(row.sessionId, attachments)} />
          </div>

          <div className="training-document-item">
            <label className="check-row"><input type="checkbox" disabled={!canUpdate} checked={row.evaluationEvidenceArchived} onChange={(event) => setFlag(row.sessionId, "evaluationEvidenceArchived", event.target.checked)} />Evaluaciones archivadas</label>
            {reasonEditor(row, row.evaluationEvidenceArchived, "evaluationEvidenceReason", "evaluaciones")}
            <DocumentControlEvidence sessionId={row.sessionId} category="EVALUATION_EVIDENCE" attachments={row.attachments} canManage={canUpdate} compact onAttachmentsChange={(attachments) => setAttachments(row.sessionId, attachments)} />
          </div>
        </div>

        {canUpdate && <div className="form-actions">
          <button type="button" disabled={saving === row.sessionId} onClick={() => void save(row)}>{saving === row.sessionId ? "Guardando…" : "Guardar control documental"}</button>
        </div>}
      </article>)}
    </div>

    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
