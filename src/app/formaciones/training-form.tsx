"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, apiJson } from "@/app/lib/api-client";
import { MultiSelectAdder } from "@/app/components/multi-select-adder";
import type { Department } from "@/domain/department";
import type { Person } from "@/domain/person";
import type { TrainerQualification } from "@/domain/trainer";
import type { TrainingCatalogs } from "@/domain/training-catalogs";
import { trainingCreateInputSchema, trainingInputSchema, type Training } from "@/domain/training";
import { collectTrainingFormErrors, type TrainingFormErrors, type TrainingFormField } from "./training-form-validation";

type FormState = {
  year: string; name: string; planningType: "PLANNED" | "UNPLANNED"; trainingTypeId: string; reason: string; isGmp: boolean;
  originType: "INTERNAL" | "EXTERNAL"; modalityId: string; plannedDurationMinutes: string; materialReference: string; content: string;
  targetGroup: string; targetDepartmentIds: string[]; plannedTrainerPersonIds: string[]; externalTrainerNamesText: string;
  evaluationMethodId: string; aptitudeCriterion: string; frequencyMonths: string; notes: string;
};

const namesFromText = (value: string) => [...new Set(value.split(/\r?\n|;|\s+\/\s+/).map((item) => item.trim()).filter(Boolean))];
const ids = (values?: string[], fallback?: string) => values?.length ? values : fallback ? [fallback] : [];

const emptyForm = (): FormState => ({
  year: String(new Date().getFullYear()), name: "", planningType: "UNPLANNED", trainingTypeId: "", reason: "", isGmp: false,
  originType: "INTERNAL", modalityId: "", plannedDurationMinutes: "", materialReference: "", content: "", targetGroup: "",
  targetDepartmentIds: [], plannedTrainerPersonIds: [], externalTrainerNamesText: "", evaluationMethodId: "", aptitudeCriterion: "", frequencyMonths: "", notes: "",
});

const fromTraining = (training: Training): FormState => ({
  year: String(training.year), name: training.name, planningType: training.planningType, trainingTypeId: training.trainingTypeId ?? "",
  reason: training.reason ?? "", isGmp: training.isGmp, originType: training.originType, modalityId: training.modalityId ?? "",
  plannedDurationMinutes: training.plannedDurationMinutes ? String(training.plannedDurationMinutes) : "", materialReference: training.materialReference ?? "",
  content: training.content ?? "", targetGroup: training.targetGroup ?? "", targetDepartmentIds: training.targetDepartmentIds ?? [],
  plannedTrainerPersonIds: ids(training.plannedTrainerPersonIds, training.plannedTrainerPersonId),
  externalTrainerNamesText: (training.externalTrainerNames?.length ? training.externalTrainerNames : training.externalTrainerName ? [training.externalTrainerName] : []).join("\n"),
  evaluationMethodId: training.evaluationMethodId ?? "", aptitudeCriterion: training.aptitudeCriterion ?? "",
  frequencyMonths: training.frequencyMonths ? String(training.frequencyMonths) : "", notes: training.notes ?? "",
});

function FieldError({ field, errors }: { field: TrainingFormField; errors: TrainingFormErrors }) {
  const message = errors[field];
  return message ? <small className="field-error" id={`${field}-error`}>{message}</small> : null;
}

export default function TrainingForm({ initial, onSaved }: { initial?: Training; onSaved?: (training: Training) => void }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initial ? fromTraining(initial) : emptyForm());
  const [catalogs, setCatalogs] = useState<TrainingCatalogs>({ trainingTypes: [], modalities: [], evaluationMethods: [] });
  const [people, setPeople] = useState<Person[]>([]);
  const [trainerQualifications, setTrainerQualifications] = useState<TrainerQualification[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fieldErrors, setFieldErrors] = useState<TrainingFormErrors>({});
  const [error, setError] = useState(""); const [saved, setSaved] = useState(""); const [saving, setSaving] = useState(false); const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadOptions() {
      try {
        const suffix = initial ? "?includeInactive=true" : "";
        const [loadedCatalogs, loadedPeople, loadedDepartments, loadedTrainerQualifications] = await Promise.all([
          apiJson<TrainingCatalogs>(`/api/training-catalogs${suffix}`),
          apiJson<Person[]>("/api/people"),
          apiJson<Department[]>(`/api/departments${suffix}`),
          apiJson<TrainerQualification[]>("/api/trainers?currentOnly=true"),
        ]);
        if (active) { setCatalogs(loadedCatalogs); setPeople(loadedPeople); setDepartments(loadedDepartments); setTrainerQualifications(loadedTrainerQualifications); }
      } catch { if (active) setError("No se han podido cargar las opciones del formulario. Inténtalo de nuevo."); }
      finally { if (active) setLoadingOptions(false); }
    }
    void loadOptions(); return () => { active = false; };
  }, [initial]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key as TrainingFormField];
      if (key === "planningType") delete next.reason;
      if (key === "originType") { delete next.plannedTrainerPersonIds; delete next.externalTrainerNames; }
      return next;
    });
    setError("");
  };
  const fieldProps = (field: TrainingFormField) => ({ name: field, "aria-invalid": Boolean(fieldErrors[field]), "aria-describedby": fieldErrors[field] ? `${field}-error` : undefined });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      externalTrainerNames: namesFromText(form.externalTrainerNamesText),
      externalTrainerNamesText: undefined,
      plannedTrainerPersonId: undefined,
      externalTrainerName: undefined,
    };
    const parsed = (initial ? trainingInputSchema : trainingCreateInputSchema).safeParse(payload);
    if (!parsed.success) {
      const validation = collectTrainingFormErrors(parsed.error.issues); setFieldErrors(validation.fields); setError("Revisa los campos destacados antes de continuar.");
      if (validation.firstField) requestAnimationFrame(() => (document.getElementsByName(validation.firstField as string)[0] as HTMLElement | undefined)?.focus());
      return;
    }
    setFieldErrors({}); setError(""); setSaved(""); setSaving(true);
    try {
      const result = await apiJson<Training>(initial ? `/api/trainings/${initial.id}` : "/api/trainings", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(initial ? { ...parsed.data, expectedUpdatedAt: initial.updatedAt } : parsed.data),
      });
      if (initial) { setSaved("Cambios guardados correctamente"); onSaved?.(result); router.refresh(); return; }
      router.push(`/formaciones/${result.id}`);
    } catch (saveError) { setError(saveError instanceof ApiClientError ? saveError.message : "No se ha podido conectar con el servidor. Inténtalo de nuevo."); }
    finally { setSaving(false); }
  }

  const qualificationsByPerson = new Map<string, string[]>();
  for (const item of trainerQualifications.filter((item) => item.person.active)) {
    qualificationsByPerson.set(item.personId, [...(qualificationsByPerson.get(item.personId) ?? []), item.authorizedSubject]);
  }
  const qualifiedPeople = people.filter((person) =>
    form.plannedTrainerPersonIds.includes(person.id)
    || (person.active && qualificationsByPerson.has(person.id))
  );
  return <form className="training-form" noValidate onSubmit={submit} aria-busy={saving}>
    {error && <div className="form-alert form-alert-error" role="alert"><strong>No se puede guardar todavía</strong><span>{error}</span></div>}
    {saved && <div className="form-alert form-alert-success" role="status"><strong>Formación actualizada</strong><span>{saved}</span></div>}

    <section className="card form-section"><div className="form-section-heading"><span>1</span><div><h2>Identificación y planificación</h2><p>Datos básicos para identificar el curso dentro del plan anual.</p></div></div><div className="form-grid">
      <label>Año *<input {...fieldProps("year")} disabled={Boolean(initial)} inputMode="numeric" value={form.year} onChange={(e) => update("year", e.target.value)} /><FieldError field="year" errors={fieldErrors} /></label>
      <label>Nombre del curso *<input {...fieldProps("name")} autoFocus={!initial} value={form.name} onChange={(e) => update("name", e.target.value)} /><FieldError field="name" errors={fieldErrors} /></label>
      <label className="full-width">Planificación *<select {...fieldProps("planningType")} value={form.planningType} onChange={(e) => update("planningType", e.target.value as FormState["planningType"])}><option value="UNPLANNED">No planificada</option><option value="PLANNED">Planificada</option></select><FieldError field="planningType" errors={fieldErrors} /></label>
      {form.planningType === "UNPLANNED" && <label className="full-width">Motivo *<input {...fieldProps("reason")} value={form.reason} onChange={(e) => update("reason", e.target.value)} /><FieldError field="reason" errors={fieldErrors} /></label>}
      <label>Tipo de formación{!initial && " *"}<select {...fieldProps("trainingTypeId")} disabled={loadingOptions} value={form.trainingTypeId} onChange={(e) => update("trainingTypeId", e.target.value)}><option value="">Selecciona un tipo</option>{catalogs.trainingTypes.filter((item) => item.active || item.id === form.trainingTypeId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (histórico)"}</option>)}</select><FieldError field="trainingTypeId" errors={fieldErrors} /></label>
      <label>Formación GMP *<select {...fieldProps("isGmp")} value={String(form.isGmp)} onChange={(e) => update("isGmp", e.target.value === "true")}><option value="false">No</option><option value="true">Sí</option></select></label>
    </div></section>

    <section className="card form-section"><div className="form-section-heading"><span>2</span><div><h2>Diseño de la formación</h2><p>Formato, duración, formadores y destinatarios.</p></div></div><div className="form-grid">
      <label>Origen *<select {...fieldProps("originType")} value={form.originType} onChange={(e) => update("originType", e.target.value as FormState["originType"])}><option value="INTERNAL">Interna</option><option value="EXTERNAL">Externa</option></select></label>
      <label>Modalidad{!initial && " *"}<select {...fieldProps("modalityId")} disabled={loadingOptions} value={form.modalityId} onChange={(e) => update("modalityId", e.target.value)}><option value="">Selecciona una modalidad</option>{catalogs.modalities.filter((item) => item.active || item.id === form.modalityId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (histórica)"}</option>)}</select><FieldError field="modalityId" errors={fieldErrors} /></label>
      <label>Duración prevista (minutos){!initial && " *"}<input {...fieldProps("plannedDurationMinutes")} inputMode="numeric" min="1" value={form.plannedDurationMinutes} onChange={(e) => update("plannedDurationMinutes", e.target.value)} /><FieldError field="plannedDurationMinutes" errors={fieldErrors} /></label>

      <fieldset className="full-width people-picker"><legend>Formadores cualificados *</legend>
        <p className="muted">{form.originType === "INTERNAL"
          ? "Selecciona uno o varios formadores cualificados, internos o externos. El origen de la formación no limita el tipo de formador."
          : "Puedes seleccionar cualquier formador cualificado o indicar manualmente una persona, entidad, organismo, curso público o plataforma web que imparta la formación."}</p>
        <MultiSelectAdder
          name="plannedTrainerPersonIds"
          options={qualifiedPeople.map((person) => ({
            id: person.id,
            label: person.fullName,
            description: !person.active
              ? "INACTIVO (histórico)"
              : (qualificationsByPerson.get(person.id) ?? []).join(" · ") || person.jobTitle,
            searchText: [person.jobTitle, person.company, ...(qualificationsByPerson.get(person.id) ?? [])].filter(Boolean).join(" "),
          }))}
          selectedIds={form.plannedTrainerPersonIds}
          onChange={(values) => update("plannedTrainerPersonIds", values)}
          placeholder="Seleccionar formadores cualificados"
          searchPlaceholder="Buscar por nombre, puesto o materia autorizada…"
          emptyMessage="No hay formadores cualificados disponibles"
        />
        <FieldError field="plannedTrainerPersonIds" errors={fieldErrors} />
        {form.originType === "EXTERNAL" && <label className="manual-trainer-field">Otro formador / entidad externa
          <textarea
            {...fieldProps("externalTrainerNames")}
            value={form.externalTrainerNamesText}
            onChange={(event) => {
              update("externalTrainerNamesText", event.target.value);
              setFieldErrors((current) => ({ ...current, externalTrainerNames: undefined }));
            }}
            placeholder={"Ej.: AEMPS · Webinar público\nUniversidad / empresa / plataforma web\nUn formador por línea"}
          />
          <small className="field-help">No es necesario dar de alta ni cualificar estos formadores. Puedes indicar varios, uno por línea.</small>
          <FieldError field="externalTrainerNames" errors={fieldErrors} />
        </label>}
      </fieldset>

      <label className="full-width">Material o documento de referencia{!initial && " *"}<input {...fieldProps("materialReference")} value={form.materialReference} onChange={(e) => update("materialReference", e.target.value)} /><FieldError field="materialReference" errors={fieldErrors} /></label>
      <label className="full-width">Contenido{!initial && " *"}<textarea {...fieldProps("content")} value={form.content} onChange={(e) => update("content", e.target.value)} /><FieldError field="content" errors={fieldErrors} /></label>
      <label className="full-width">Colectivo objetivo{!initial && " *"}<input {...fieldProps("targetGroup")} value={form.targetGroup} onChange={(e) => update("targetGroup", e.target.value)} placeholder="Ej.: nuevas incorporaciones, jefes de turno, plantilla completa…" /><FieldError field="targetGroup" errors={fieldErrors} /></label>
      <fieldset className="full-width people-picker"><legend>Departamentos destinatarios</legend><p className="muted">Selecciona y añade uno o varios departamentos; el colectivo objetivo se conserva como información adicional.</p>
        <MultiSelectAdder
          name="targetDepartmentIds"
          options={departments.filter((department) => department.active || form.targetDepartmentIds.includes(department.id)).map((department) => ({
            id: department.id,
            label: department.name,
            description: `${department.code}${department.active ? "" : " · INACTIVO (histórico)"}`,
          }))}
          selectedIds={form.targetDepartmentIds}
          onChange={(values) => update("targetDepartmentIds", values)}
          placeholder="Seleccionar departamentos"
          searchPlaceholder="Buscar departamento…"
          emptyMessage="No hay departamentos disponibles"
        />
        <FieldError field="targetDepartmentIds" errors={fieldErrors} />
      </fieldset>
    </div></section>

    <section className="card form-section"><div className="form-section-heading"><span>3</span><div><h2>Evaluación y seguimiento</h2><p>Define cómo se comprobará la aptitud y, si aplica, la periodicidad.</p></div></div><div className="form-grid">
      <label>Método de evaluación{!initial && " *"}<select {...fieldProps("evaluationMethodId")} disabled={loadingOptions} value={form.evaluationMethodId} onChange={(e) => update("evaluationMethodId", e.target.value)}><option value="">Selecciona un método</option>{catalogs.evaluationMethods.filter((item) => item.active || item.id === form.evaluationMethodId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (histórico)"}</option>)}</select><FieldError field="evaluationMethodId" errors={fieldErrors} /></label>
      <label>Criterio de aptitud{!initial && " *"}<input {...fieldProps("aptitudeCriterion")} value={form.aptitudeCriterion} onChange={(e) => update("aptitudeCriterion", e.target.value)} /><FieldError field="aptitudeCriterion" errors={fieldErrors} /></label>
      <label>Frecuencia (meses) <span className="optional-label">Opcional</span><input {...fieldProps("frequencyMonths")} inputMode="numeric" min="1" value={form.frequencyMonths} onChange={(e) => update("frequencyMonths", e.target.value)} /><FieldError field="frequencyMonths" errors={fieldErrors} /></label>
      <label className="full-width">Observaciones <span className="optional-label">Opcional</span><textarea {...fieldProps("notes")} value={form.notes} onChange={(e) => update("notes", e.target.value)} /><FieldError field="notes" errors={fieldErrors} /></label>
    </div></section>

    <div className="form-actions sticky-actions"><span className="required-note">* Campos obligatorios</span><button disabled={saving || loadingOptions} type="submit">{saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear formación"}</button></div>
  </form>;
}
