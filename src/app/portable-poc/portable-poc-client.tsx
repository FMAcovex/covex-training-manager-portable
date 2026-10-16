"use client";

import { useState, type FormEvent } from "react";
import { DashboardSection, StatusBadge } from "@/app/components/ui";
import { acquirePortableGraphToken } from "@/portable/auth/msal-client";
import type { PortableTraining, PortableTrainingInput } from "@/portable/sharepoint/training-repository";

type UploadedDocument = { id: string; name: string; size: number; eTag: string };

const emptyTraining: PortableTrainingInput = {
  code: "",
  year: new Date().getFullYear(),
  name: "",
  planningType: "UNPLANNED",
  reason: "Prueba vertical H10A",
  isGmp: false,
  originType: "INTERNAL",
};

async function apiJson<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `La operación ha fallado (${response.status}).`);
  return body as T;
}

export default function PortablePocClient() {
  const [accessToken, setAccessToken] = useState("");
  const [accountName, setAccountName] = useState("");
  const [trainings, setTrainings] = useState<PortableTraining[]>([]);
  const [editing, setEditing] = useState<PortableTraining>();
  const [training, setTraining] = useState<PortableTrainingInput>(emptyTraining);
  const [selectedTrainingId, setSelectedTrainingId] = useState("");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [message, setMessage] = useState("Conecta Microsoft Entra para iniciar la prueba vertical.");
  const [busy, setBusy] = useState(false);

  async function withBusy(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La operación no se pudo completar.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh(token = accessToken) {
    const result = await apiJson<{ items: PortableTraining[] }>("/api/portable/trainings", token);
    setTrainings(result.items);
    if (!selectedTrainingId && result.items[0]) setSelectedTrainingId(result.items[0].id);
  }

  function connect() {
    void withBusy(async () => {
      const result = await acquirePortableGraphToken();
      setAccessToken(result.accessToken);
      setAccountName(result.account.name ?? result.account.username);
      await refresh(result.accessToken);
      setMessage("Conexión delegada preparada. Los tokens permanecen en la sesión local de MSAL.");
    });
  }

  function submitTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void withBusy(async () => {
      const result = editing
        ? await apiJson<PortableTraining>(`/api/portable/trainings/${encodeURIComponent(editing.id)}`, accessToken, {
            method: "PATCH",
            headers: { "If-Match": editing.eTag },
            body: JSON.stringify(training),
          })
        : await apiJson<PortableTraining>("/api/portable/trainings", accessToken, {
            method: "POST",
            body: JSON.stringify(training),
          });
      await refresh();
      setEditing(undefined);
      setTraining(emptyTraining);
      setSelectedTrainingId(result.id);
      setMessage(editing ? "Formación modificada con control de concurrencia ETag." : "Formación creada en SharePoint Lists.");
    });
  }

  function chooseTraining(item: PortableTraining) {
    setEditing(item);
    setTraining({
      code: item.code,
      year: item.year,
      name: item.name,
      planningType: item.planningType,
      reason: item.reason,
      isGmp: item.isGmp,
      originType: item.originType,
    });
  }

  function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || !selectedTrainingId) return;
    void withBusy(async () => {
      const body = new FormData();
      body.set("trainingId", selectedTrainingId);
      body.set("file", file);
      const uploaded = await apiJson<UploadedDocument>("/api/portable/documents", accessToken, { method: "POST", body });
      setDocuments((current) => [uploaded, ...current]);
      form.reset();
      setMessage("Documento cargado en la biblioteca de SharePoint.");
    });
  }

  function downloadDocument(item: UploadedDocument) {
    void withBusy(async () => {
      const response = await fetch(`/api/portable/documents/${encodeURIComponent(item.id)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "No se pudo recuperar el documento.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.name;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Documento recuperado desde SharePoint.");
    });
  }

  return (
    <div className="page-stack">
      <div className="card">
        <div className="card-header-row">
          <div>
            <h2>Conexión portable</h2>
            <p className="muted">MSAL público con Authorization Code + PKCE; no usa secretos de cliente.</p>
          </div>
          <button type="button" onClick={connect} disabled={busy}>{accessToken ? "Renovar sesión" : "Conectar Microsoft Entra"}</button>
        </div>
        {accountName && <p><strong>Cuenta:</strong> {accountName}</p>}
        <p role="status" className="muted">{message}</p>
      </div>

      <DashboardSection title="Formación en SharePoint List" description="Alta, consulta y modificación vertical con ETag/If-Match.">
        <form className="card form-grid" onSubmit={submitTraining}>
          <label>Código<input required value={training.code} onChange={(event) => setTraining({ ...training, code: event.target.value })} /></label>
          <label>Año<input required type="number" min="2000" max="2100" value={training.year} onChange={(event) => setTraining({ ...training, year: Number(event.target.value) })} /></label>
          <label className="wide">Nombre<input required value={training.name} onChange={(event) => setTraining({ ...training, name: event.target.value })} /></label>
          <label>Planificación<select value={training.planningType} onChange={(event) => setTraining({ ...training, planningType: event.target.value as PortableTrainingInput["planningType"] })}><option value="PLANNED">Planificada</option><option value="UNPLANNED">No planificada</option></select></label>
          <label>Origen<select value={training.originType} onChange={(event) => setTraining({ ...training, originType: event.target.value as PortableTrainingInput["originType"] })}><option value="INTERNAL">Interna</option><option value="EXTERNAL">Externa</option></select></label>
          <label className="wide">Motivo<input value={training.reason ?? ""} onChange={(event) => setTraining({ ...training, reason: event.target.value })} /></label>
          <label className="checkbox-row"><input type="checkbox" checked={training.isGmp} onChange={(event) => setTraining({ ...training, isGmp: event.target.checked })} /> Formación GMP</label>
          <div className="form-actions wide">
            <button type="submit" disabled={!accessToken || busy}>{editing ? "Guardar con ETag" : "Crear formación"}</button>
            {editing && <button type="button" className="button-secondary" onClick={() => { setEditing(undefined); setTraining(emptyTraining); }}>Cancelar edición</button>}
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Nombre</th><th>Año</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              {trainings.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td>{item.year}</td><td><StatusBadge tone="success">Sincronizada</StatusBadge></td><td><button type="button" className="button-link" onClick={() => chooseTraining(item)}>Editar</button></td></tr>)}
              {!trainings.length && <tr><td colSpan={5} className="empty-cell">No hay datos cargados o todavía no se ha conectado.</td></tr>}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection title="Documento en biblioteca SharePoint" description="Carga simple y recuperación de un documento de hasta 4 MB.">
        <form className="card form-grid" onSubmit={uploadDocument}>
          <label>Formación<select required value={selectedTrainingId} onChange={(event) => setSelectedTrainingId(event.target.value)}><option value="">Selecciona una formación</option>{trainings.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label>Documento<input required name="file" type="file" /></label>
          <div className="form-actions wide"><button type="submit" disabled={!accessToken || !selectedTrainingId || busy}>Cargar documento</button></div>
        </form>
        <ul className="card-list">{documents.map((item) => <li key={item.id}><span>{item.name} · {item.size} bytes</span><button type="button" className="button-link" onClick={() => downloadDocument(item)}>Recuperar</button></li>)}</ul>
      </DashboardSection>
    </div>
  );
}
