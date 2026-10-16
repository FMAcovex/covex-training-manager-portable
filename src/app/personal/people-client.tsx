"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ConfirmActionDialog } from "@/app/components/confirm-action-dialog";
import { ApiClientError, apiJson } from "@/app/lib/api-client";
import type { Department } from "@/domain/department";
import { personInputSchema, type Person, type PersonInput } from "@/domain/person";

const empty: PersonInput = { fullName: "", employeeCode: "", personType: "INTERNAL", company: "", departmentId: "", jobTitle: "", notes: "" };
type PersonField = keyof PersonInput;
type PersonFieldErrors = Partial<Record<PersonField, string>>;

export default function PeopleClient({ canManage, canReadHistory }: { canManage: boolean; canReadHistory: boolean }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<PersonInput>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PersonFieldErrors>({});
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDeactivation, setPendingDeactivation] = useState<Person | null>(null);
  const [changingState, setChangingState] = useState(false);
  const departmentName = (id?: string) => departments.find((department) => department.id === id)?.name ?? "—";
  const load = () => Promise.all([
    apiJson<Person[]>("/api/people"),
    apiJson<Department[]>("/api/departments?includeInactive=true"),
  ]).then(([loadedPeople, loadedDepartments]) => { setPeople(loadedPeople); setDepartments(loadedDepartments); });
  useEffect(() => { void load().catch(() => setError("No se ha podido cargar el personal o los departamentos.")); }, []);
  const update = <K extends keyof PersonInput>(key: K, value: PersonInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setError(""); setSaved("");
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = personInputSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: PersonFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) nextErrors[field as PersonField] = issue.message;
      }
      setFieldErrors(nextErrors);
      setError("Revisa los campos destacados antes de continuar.");
      const first = Object.keys(nextErrors)[0];
      if (first) requestAnimationFrame(() => (document.getElementsByName(first)[0] as HTMLElement | undefined)?.focus());
      return;
    }
    setSaving(true); setError(""); setSaved(""); setFieldErrors({});
    try {
      await apiJson<Person>(editing ? `/api/people/${editing}` : "/api/people", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      setSaved(editing ? "Cambios guardados correctamente" : "Persona añadida correctamente");
      setForm(empty); setEditing(null); await load();
    } catch (saveError) {
      setError(saveError instanceof ApiClientError ? saveError.message : "No se ha podido conectar con el servidor.");
    } finally { setSaving(false); }
  }
  function edit(person: Person) { setEditing(person.id); setFieldErrors({}); setError(""); setSaved(""); setForm({ fullName: person.fullName, employeeCode: person.employeeCode ?? "", personType: person.personType, company: person.company ?? "", departmentId: person.departmentId ?? "", jobTitle: person.jobTitle, notes: person.notes ?? "" }); }
  async function deactivate() {
    if (!pendingDeactivation) return;
    setChangingState(true); setError("");
    const response = await fetch(`/api/people/${pendingDeactivation.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setChangingState(false);
    if (!response.ok) { setError(result.error ?? "No se ha podido desactivar la persona"); return; }
    setPendingDeactivation(null); void load();
  }
  async function activate(id: string) {
    setChangingState(true); setError("");
    const response = await fetch(`/api/people/${id}/activate`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    setChangingState(false);
    if (!response.ok) { setError(result.error ?? "No se ha podido reactivar la persona"); return; }
    void load();
  }
  return <>
    {canManage && <section className="card"><div className="toolbar"><h2>{editing ? "Editar persona" : "Alta de persona"}</h2>{editing && <button className="secondary" type="button" onClick={() => { setEditing(null); setForm(empty); setFieldErrors({}); setError(""); setSaved(""); }}>Cancelar</button>}</div>{error && <div className="form-alert form-alert-error" role="alert"><strong>No se puede guardar todavía</strong><span>{error}</span></div>}{saved && <div className="form-alert form-alert-success" role="status"><strong>Operación completada</strong><span>{saved}</span></div>}<form className="form-grid" noValidate onSubmit={submit}><label>Nombre completo<input name="fullName" aria-invalid={Boolean(fieldErrors.fullName)} value={form.fullName} onChange={(event) => update("fullName", event.target.value)} />{fieldErrors.fullName && <small className="field-error">{fieldErrors.fullName}</small>}</label><label>Código empleado<input name="employeeCode" value={form.employeeCode ?? ""} onChange={(event) => update("employeeCode", event.target.value)} /></label><label>Tipo<select name="personType" value={form.personType} onChange={(event) => update("personType", event.target.value as Person["personType"])}><option value="INTERNAL">INTERNO</option><option value="EXTERNAL">EXTERNO</option></select></label><label>Empresa<input name="company" aria-invalid={Boolean(fieldErrors.company)} value={form.company ?? ""} onChange={(event) => update("company", event.target.value)} />{fieldErrors.company && <small className="field-error">{fieldErrors.company}</small>}</label><label>Departamento<select name="departmentId" aria-invalid={Boolean(fieldErrors.departmentId)} value={form.departmentId ?? ""} onChange={(event) => update("departmentId", event.target.value)}><option value="">Selecciona un departamento</option>{departments.filter((department) => department.active || (Boolean(editing) && department.id === form.departmentId)).map((department) => <option key={department.id} value={department.id}>{department.name}{department.active ? "" : " (inactivo, valor histórico)"}</option>)}</select>{fieldErrors.departmentId && <small className="field-error">{fieldErrors.departmentId}</small>}</label><label>Puesto<input name="jobTitle" aria-invalid={Boolean(fieldErrors.jobTitle)} value={form.jobTitle} onChange={(event) => update("jobTitle", event.target.value)} />{fieldErrors.jobTitle && <small className="field-error">{fieldErrors.jobTitle}</small>}</label><label>Notas<textarea name="notes" value={form.notes ?? ""} onChange={(event) => update("notes", event.target.value)} /></label><div className="form-actions"><button disabled={saving} type="submit">{saving ? "Guardando…" : editing ? "Guardar cambios" : "Añadir persona"}</button></div></form></section>}
    <section className="card"><h2>Personas activas e históricas</h2><div className="table-scroll"><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Empresa</th><th>Departamento</th><th>Puesto</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}><td>{canReadHistory ? <Link className="text-link" href={`/personal/${person.id}`}>{person.fullName}</Link> : person.fullName}<br /><small>{person.employeeCode ?? ""}</small></td><td><span className={`badge ${person.personType === "EXTERNAL" ? "external" : ""}`}>{person.personType === "EXTERNAL" ? "EXTERNO" : "INTERNO"}</span></td><td>{person.company || "—"}</td><td>{departmentName(person.departmentId)}</td><td>{person.jobTitle}</td><td>{person.active ? "Activa" : "Inactiva"}</td><td><div className="button-row">{canReadHistory && <Link className="button-link secondary-link" href={`/personal/${person.id}`}>Historial</Link>}{canManage && <button className="secondary" type="button" onClick={() => edit(person)}>Editar</button>}{canManage && (person.active ? <button className="secondary" type="button" onClick={() => setPendingDeactivation(person)}>Desactivar</button> : <button className="secondary" type="button" disabled={changingState} onClick={() => void activate(person.id)}>Reactivar</button>)}</div></td></tr>)}</tbody></table></div></section>
    <ConfirmActionDialog
      open={Boolean(pendingDeactivation)}
      title="Desactivar persona"
      description={pendingDeactivation ? `Se desactivará a ${pendingDeactivation.fullName}. El registro y su histórico se conservarán, pero dejará de estar disponible para nuevas asignaciones.` : ""}
      confirmLabel="Desactivar"
      busy={changingState}
      onCancel={() => setPendingDeactivation(null)}
      onConfirm={deactivate}
    />
  </>;
}
