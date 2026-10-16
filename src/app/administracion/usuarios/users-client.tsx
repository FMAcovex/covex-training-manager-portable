"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmActionDialog } from "@/app/components/confirm-action-dialog";
import { formatDateTimeEs } from "@/app/lib/format";
import { ApiClientError, apiJson } from "@/app/lib/api-client";
import type { UserProfile } from "@/administration/types";
import type { AppRole } from "@/auth/current-user";

const blank = { entraObjectId: "", email: "", displayName: "", role: "USER" as AppRole, active: true };
type Draft = { displayName: string; email: string; role: AppRole };

export default function UsersClient() {
  const [rows, setRows] = useState<UserProfile[]>([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingStateChange, setPendingStateChange] = useState<UserProfile | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<{ row: UserProfile; draft: Draft } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await apiJson<UserProfile[]>("/api/admin/users"));
    } catch (loadError) {
      setError(loadError instanceof ApiClientError ? loadError.message : "No se han podido cargar los usuarios");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await apiJson<UserProfile>("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setForm(blank); await load();
    } catch (createError) {
      setError(createError instanceof ApiClientError ? createError.message : "No se ha podido crear el perfil");
    } finally { setSaving(false); }
  }

  async function patch(id: string, body: object) {
    setSaving(true); setError("");
    try {
      await apiJson<UserProfile>(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await load(); return true;
    } catch (patchError) {
      setError(patchError instanceof ApiClientError ? patchError.message : "No se han podido guardar los cambios");
      return false;
    } finally { setSaving(false); }
  }

  function beginEdit(row: UserProfile) {
    setEditingId(row.id);
    setDraft({ displayName: row.displayName, email: row.email, role: row.role });
    setError("");
  }

  function cancelEdit() { setEditingId(null); setDraft(null); }

  async function saveEdit(row: UserProfile) {
    if (!draft) return;
    if (draft.role !== row.role) { setPendingRoleChange({ row, draft }); return; }
    if (await patch(row.id, draft)) cancelEdit();
  }

  async function confirmRoleChange() {
    if (!pendingRoleChange) return;
    const { row, draft: next } = pendingRoleChange;
    if (await patch(row.id, next)) { setPendingRoleChange(null); cancelEdit(); }
  }

  async function confirmStateChange() {
    if (!pendingStateChange) return;
    const row = pendingStateChange;
    if (await patch(row.id, { active: !row.active })) setPendingStateChange(null);
  }

  return <>
    <section className="card">
      <h2>Nuevo perfil</h2>
      <form className="form-grid" onSubmit={create}>
        <label>Nombre<input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
        <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Identificador Entra<input required value={form.entraObjectId} onChange={(e) => setForm({ ...form, entraObjectId: e.target.value })} /></label>
        <label>Rol<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}><option>USER</option><option>RESPONSIBLE</option><option>ADMIN</option></select></label>
        <div className="form-actions"><button disabled={saving}>{saving ? "Guardando…" : "Crear perfil"}</button></div>
      </form>
      {error && <div className="form-alert form-alert-error" role="alert"><strong>No se ha podido completar la operación</strong><span>{error}</span></div>}
    </section>

    <section className="card table-scroll">
      <table>
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Identificador Entra</th><th>Actualizado</th><th>Acciones</th></tr></thead>
        <tbody>{rows.map((row) => {
          const editing = editingId === row.id && draft;
          return <tr key={row.id}>
            <td>{editing ? <input aria-label={`Nombre ${row.email}`} value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} /> : row.displayName}</td>
            <td>{editing ? <input aria-label={`Email ${row.displayName}`} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /> : row.email}</td>
            <td>{editing ? <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as AppRole })}><option>USER</option><option>RESPONSIBLE</option><option>ADMIN</option></select> : row.role}</td>
            <td><span className={`badge ${row.active ? "" : "status-not_executed"}`}>{row.active ? "Activo" : "Inactivo"}</span></td>
            <td><code>{row.entraObjectId}</code></td>
            <td>{formatDateTimeEs(row.updatedAt)}</td>
            <td><div className="button-row">
              {editing ? <>
                <button disabled={saving} onClick={() => void saveEdit(row)}>{saving ? "Guardando…" : "Guardar"}</button>
                <button className="secondary" disabled={saving} onClick={cancelEdit}>Cancelar</button>
              </> : <button className="secondary" onClick={() => beginEdit(row)}>Editar</button>}
              <button className={row.active ? "danger" : ""} disabled={saving} onClick={() => setPendingStateChange(row)}>{row.active ? "Desactivar" : "Activar"}</button>
            </div></td>
          </tr>;
        })}</tbody>
      </table>
    </section>

    <ConfirmActionDialog
      open={Boolean(pendingRoleChange)}
      title="Confirmar cambio de rol"
      description={pendingRoleChange ? `${pendingRoleChange.row.displayName} cambiará de ${pendingRoleChange.row.role} a ${pendingRoleChange.draft.role}. Este cambio modifica los permisos disponibles en la aplicación.` : ""}
      confirmLabel="Cambiar rol"
      tone="primary"
      busy={saving}
      onCancel={() => setPendingRoleChange(null)}
      onConfirm={confirmRoleChange}
    />
    <ConfirmActionDialog
      open={Boolean(pendingStateChange)}
      title={pendingStateChange?.active ? "Desactivar usuario" : "Activar usuario"}
      description={pendingStateChange ? (pendingStateChange.active
        ? `${pendingStateChange.displayName} dejará de poder acceder a la aplicación.`
        : `${pendingStateChange.displayName} volverá a tener acceso con el rol ${pendingStateChange.role}.`) : ""}
      confirmLabel={pendingStateChange?.active ? "Desactivar" : "Activar"}
      busy={saving}
      onCancel={() => setPendingStateChange(null)}
      onConfirm={confirmStateChange}
    />
  </>;
}
