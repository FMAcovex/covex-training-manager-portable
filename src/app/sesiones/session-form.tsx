"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MultiSelectAdder } from "@/app/components/multi-select-adder";
import type { Department } from "@/domain/department";
import type { Person } from "@/domain/person";
import type { TrainerQualification } from "@/domain/trainer";
import { sessionInputSchema, type TrainingSession } from "@/domain/training-session";
import type { ZodIssue } from "zod";
import type { Training } from "@/domain/training";
import { ApiClientError, apiJson, isAbortError } from "@/app/lib/api-client";

type State = { plannedDate: string; trainerPersonIds: string[]; externalTrainerNamesText: string; durationMinutes: string; blankAttendanceRows: string; notes: string; attendeePersonIds: string[] };
type FieldErrors = Partial<Record<"plannedDate" | "trainerPersonIds" | "externalTrainerNames" | "durationMinutes" | "blankAttendanceRows" | "notes" | "attendeePersonIds", string>>;
const collectErrors = (issues: ZodIssue[]) => issues.reduce<FieldErrors>((errors, issue) => {
  const field = issue.path[0];
  if (typeof field === "string" && !(field in errors)) errors[field as keyof FieldErrors] = issue.message;
  return errors;
}, {});
const fallbackIds = (values?: string[], fallback?: string) => values?.length ? values : fallback ? [fallback] : [];
const names = (value: string) => [...new Set(value.split(/\r?\n|;|\s+\/\s+/).map((item) => item.trim()).filter(Boolean))];

const initialState = (training: Training, session?: TrainingSession): State => ({
  plannedDate: session?.plannedDate ?? "",
  trainerPersonIds: session ? fallbackIds(session.trainerPersonIds, session.trainerPersonId) : fallbackIds(training.plannedTrainerPersonIds, training.plannedTrainerPersonId),
  externalTrainerNamesText: (session
    ? (session.externalTrainerNames?.length ? session.externalTrainerNames : session.externalTrainerName ? [session.externalTrainerName] : [])
    : (training.externalTrainerNames?.length ? training.externalTrainerNames : training.externalTrainerName ? [training.externalTrainerName] : [])
  ).join("\n"),
  durationMinutes: String(session?.durationMinutes ?? training.plannedDurationMinutes ?? ""),
  blankAttendanceRows: String(session?.blankAttendanceRows ?? 0),
  notes: session?.notes ?? "",
  attendeePersonIds: session?.attendances.map((item) => item.personId) ?? [],
});

export default function SessionForm({ training, initial, onSaved }: { training: Training; initial?: TrainingSession; onSaved?: (session: TrainingSession) => void }) {
  const router = useRouter();
  const [form, setForm] = useState<State>(() => initialState(training, initial));
  const [people, setPeople] = useState<Person[]>([]);
  const [trainerQualifications, setTrainerQualifications] = useState<TrainerQualification[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState(""); const [fieldErrors, setFieldErrors] = useState<FieldErrors>({}); const [saved, setSaved] = useState(""); const [saving, setSaving] = useState(false);
  const [optionsReady, setOptionsReady] = useState(false);
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [uncertainSave, setUncertainSave] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setOptionsReady(false);
    void Promise.all([
      apiJson<Person[]>("/api/people", { signal: controller.signal }),
      apiJson<Department[]>("/api/departments?includeInactive=true", { signal: controller.signal }),
      apiJson<TrainerQualification[]>("/api/trainers?currentOnly=true", { signal: controller.signal }),
    ]).then(([p, d, q]) => {
      if (!Array.isArray(p) || !Array.isArray(d) || !Array.isArray(q)) throw new Error("Catálogo no válido");
      if (controller.signal.aborted) return;
      setPeople(p); setDepartments(d); setTrainerQualifications(q); setOptionsReady(true); setError("");
    }).catch((caught) => {
      if (controller.signal.aborted || isAbortError(caught)) return;
      setError(caught instanceof ApiClientError && caught.status === 401
        ? "La sesión ha caducado. Conserva el borrador e inicia sesión de nuevo antes de recargar las opciones."
        : "No se pudieron cargar las opciones. Conserva el borrador y vuelve a cargar las opciones.");
    });
    return () => controller.abort();
  }, [optionsAttempt]);
  const attendeeSet = new Set(form.attendeePersonIds);
  const trainerSet = new Set(form.trainerPersonIds);
  const closedSession = initial?.executionStatus === "EXECUTED" || initial?.executionStatus === "NOT_EXECUTED";
  const selectable = people.filter((person) => person.active || attendeeSet.has(person.id));
  const qualificationsByPerson = new Map<string, string[]>();
  for (const item of trainerQualifications.filter((item) => item.person.active)) {
    qualificationsByPerson.set(item.personId, [...(qualificationsByPerson.get(item.personId) ?? []), item.authorizedSubject]);
  }
  const qualifiedTrainers = people.filter((person) => trainerSet.has(person.id) || (person.active && qualificationsByPerson.has(person.id)));
  const personDescription = (person: Person) => {
    const department = departments.find((item) => item.id === person.departmentId)?.name;
    return [person.personType === "EXTERNAL" ? `EXTERNO · ${person.company}` : "INTERNO", department, person.jobTitle].filter(Boolean).join(" · ");
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !optionsReady || uncertainSave) return;
    const parsed = sessionInputSchema.safeParse({
      trainingId: training.id, plannedDate: form.plannedDate, durationMinutes: form.durationMinutes, blankAttendanceRows: form.blankAttendanceRows, notes: form.notes,
      attendeePersonIds: form.attendeePersonIds, trainerPersonIds: form.trainerPersonIds,
      externalTrainerNames: names(form.externalTrainerNamesText),
    });
    if (!parsed.success) {
      const errors = collectErrors(parsed.error.issues);
      setFieldErrors(errors); setError("Revisa los campos destacados antes de continuar.");
      const first = Object.keys(errors)[0];
      if (first) requestAnimationFrame(() => (document.getElementsByName(first)[0] as HTMLElement | undefined)?.focus());
      return;
    }
    setSaving(true); setError(""); setSaved(""); setFieldErrors({});
    try {
      const result = await apiJson<TrainingSession>(initial ? `/api/sessions/${initial.id}` : `/api/trainings/${training.id}/sessions`, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...parsed.data, ...(initial ? { expectedUpdatedAt: initial.updatedAt } : {}) }) });
      if (!result?.id) throw new Error("Respuesta de guardado incompleta");
      if (initial) { setSaved("Cambios guardados correctamente"); onSaved?.(result); router.refresh(); } else router.push(`/sesiones/${result.id}`);
    } catch (caught) {
      if (caught instanceof ApiClientError) setError(caught.message);
      else {
        setUncertainSave(true);
        setError("La conexión se interrumpió y no se pudo confirmar el guardado. El borrador sigue aquí. Comprueba el expediente antes de repetir la operación; si persiste un bloqueo, solicita reconciliación a IT.");
      }
    } finally { setSaving(false); }
  }

  return <form className="form-grid" noValidate onSubmit={submit}>
    {error && <div className="full-width form-alert form-alert-error" role="alert"><strong>No se puede guardar todavía</strong><span>{error}</span></div>}
    {saved && <div className="full-width form-alert form-alert-success" role="status"><strong>Sesión actualizada</strong><span>{saved}</span></div>}
    {!optionsReady && <div className="full-width"><button className="secondary" type="button" onClick={() => setOptionsAttempt((attempt) => attempt + 1)}>Recargar opciones</button></div>}
    {uncertainSave && <p className="full-width">Conserva una copia de tu borrador antes de salir. Comprueba las sesiones en la ficha de formación para determinar si el guardado llegó a completarse.</p>}
    <label>Fecha prevista *<input name="plannedDate" aria-invalid={Boolean(fieldErrors.plannedDate)} type="date" value={form.plannedDate} onChange={(event) => { setForm({ ...form, plannedDate: event.target.value }); setFieldErrors((current) => ({ ...current, plannedDate: undefined })); }} />{fieldErrors.plannedDate && <small className="field-error">{fieldErrors.plannedDate}</small>}</label>
    <label>Duración (minutos) *<input name="durationMinutes" aria-invalid={Boolean(fieldErrors.durationMinutes)} inputMode="numeric" value={form.durationMinutes} onChange={(event) => { setForm({ ...form, durationMinutes: event.target.value }); setFieldErrors((current) => ({ ...current, durationMinutes: undefined })); }} />{fieldErrors.durationMinutes && <small className="field-error">{fieldErrors.durationMinutes}</small>}</label>
    <fieldset className="full-width people-picker"><legend>Formadores cualificados *</legend><p className="muted">{training.originType === "INTERNAL"
      ? "La sesión parte de los formadores previstos y permite seleccionar formadores cualificados internos o externos."
      : "Puedes mantener o seleccionar cualquier formador cualificado, o escribir manualmente una persona, entidad, organismo o plataforma que imparta esta sesión."}</p>
      <MultiSelectAdder
        name="trainerPersonIds"
        options={qualifiedTrainers.map((person) => ({ id: person.id, label: person.fullName, description: `${(qualificationsByPerson.get(person.id) ?? []).join(" · ") || personDescription(person)}${!person.active ? " · INACTIVO (histórico)" : ""}`, searchText: [personDescription(person), ...(qualificationsByPerson.get(person.id) ?? [])].join(" ") }))}
        selectedIds={form.trainerPersonIds}
        onChange={(values) => setForm((current) => ({ ...current, trainerPersonIds: values }))}
        placeholder="Seleccionar formadores cualificados"
        searchPlaceholder="Buscar por nombre, puesto o materia autorizada…"
        emptyMessage="No hay formadores cualificados disponibles"
      />
      {fieldErrors.trainerPersonIds && <small className="field-error">{fieldErrors.trainerPersonIds}</small>}
      {training.originType === "EXTERNAL" && <label className="manual-trainer-field">Otro formador / entidad externa
        <textarea name="externalTrainerNames" aria-invalid={Boolean(fieldErrors.externalTrainerNames)} value={form.externalTrainerNamesText} onChange={(event) => setForm({ ...form, externalTrainerNamesText: event.target.value })} placeholder={"Ej.: organismo oficial · webinar público\nEmpresa / universidad / plataforma web\nUn formador por línea"} />
        <small className="field-help">No es necesario que figure en el registro de Formadores cualificados.</small>
      </label>}
    </fieldset>
    <label>Filas en blanco en Anexo III<input name="blankAttendanceRows" aria-invalid={Boolean(fieldErrors.blankAttendanceRows)} type="number" min="0" inputMode="numeric" value={form.blankAttendanceRows} onChange={(event) => setForm({ ...form, blankAttendanceRows: event.target.value })} /><small className="field-help">Reserva filas vacías para asistentes no previstos que puedan apuntarse a mano.</small></label>
    <label className="full-width">Observaciones<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
    {closedSession ? <section className="full-width people-picker"><h3>Asistentes registrados</h3><p className="muted">El histórico de asistentes no puede modificarse desde la edición general de una sesión cerrada.</p>{selectable.filter((person) => attendeeSet.has(person.id)).map((person) => <div key={person.id}><strong>{person.fullName}</strong><small>{personDescription(person)}{!person.active ? " · INACTIVO (histórico)" : ""}</small></div>)}</section>
      : <fieldset className="full-width people-picker"><legend>Asistentes previstos</legend>
        <MultiSelectAdder
          name="attendeePersonIds"
          options={selectable.map((person) => ({ id: person.id, label: person.fullName, description: `${personDescription(person)}${!person.active ? " · INACTIVO (histórico)" : ""}`, searchText: [person.employeeCode, person.jobTitle, person.company, departments.find((item) => item.id === person.departmentId)?.name].filter(Boolean).join(" "), filterValue: person.departmentId ?? "__external" }))}
          selectedIds={form.attendeePersonIds}
          onChange={(values) => setForm((current) => ({ ...current, attendeePersonIds: values }))}
          placeholder="Seleccionar asistentes"
          searchPlaceholder="Buscar por nombre, puesto, código o departamento…"
          filters={[...departments.filter((department) => department.active || selectable.some((person) => person.departmentId === department.id)).map((department) => ({ value: department.id, label: department.name })), { value: "__external", label: "Externos / sin departamento" }]}
          filterPlaceholder="Todos los departamentos"
          enableSelectAll
          emptyMessage="No hay asistentes disponibles"
        />
      </fieldset>}
    <div className="form-actions"><button disabled={saving || !optionsReady || uncertainSave}>{saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear sesión"}</button></div>
  </form>;
}
