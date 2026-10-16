"use client";

import { useState } from "react";
import type { DocumentControlAttachmentCategory, DocumentControlAttachmentMeta } from "@/document-control/types";

export function DocumentControlEvidence({
  sessionId,
  category,
  attachments,
  canManage,
  compact = false,
  onAttachmentsChange,
}: {
  sessionId: string;
  category: DocumentControlAttachmentCategory;
  attachments: DocumentControlAttachmentMeta[];
  canManage: boolean;
  compact?: boolean;
  onAttachmentsChange: (attachments: DocumentControlAttachmentMeta[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const files = attachments.filter((item) => item.category === category);

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const body = new FormData();
      body.set("category", category);
      body.set("file", file);
      const response = await fetch(`/api/sessions/${sessionId}/document-control/attachments`, { method: "POST", body });
      const result = await response.json() as DocumentControlAttachmentMeta & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo adjuntar el documento");
      onAttachmentsChange([result, ...attachments]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo adjuntar el documento");
    } finally { setBusy(false); }
  }

  async function remove(attachmentId: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/document-control/attachments/${attachmentId}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo retirar el documento");
      onAttachmentsChange(attachments.filter((item) => item.id !== attachmentId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo retirar el documento");
    } finally { setBusy(false); }
  }

  return <div className="document-control-evidence">
    {files.length > 0 && <div className="document-control-files">
      {files.map((file) => <div className="document-control-file" key={file.id}>
        <a className="text-link" href={`/api/sessions/${sessionId}/document-control/attachments/${file.id}`} title={file.fileName}>{file.fileName}</a>
        {canManage && <button className="tertiary" type="button" disabled={busy} onClick={() => void remove(file.id)}>Retirar</button>}
      </div>)}
    </div>}
    {canManage && <label className="button-link secondary-link document-attach-button">
      {busy ? "Procesando…" : compact ? "Adjuntar" : "Adjuntar documento"}
      <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; void upload(file); event.currentTarget.value = ""; }} />
    </label>}
    {error && <small className="field-error" role="alert">{error}</small>}
  </div>;
}
