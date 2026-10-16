"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiJson } from "@/app/lib/api-client";
import { formatDateEs } from "@/app/lib/format";
import type { Department } from "@/domain/department";
import { personInputSchema, type Person, type PersonInput } from "@/domain/person";
import { trainerQualificationInputSchema, type TrainerDocumentMeta, type TrainerQualification } from "@/domain/trainer";

type FormState = {
  personId: string;
  authorizedSubject: string;
  evidence: string;
  qualifiedFrom: string;
  qualifiedTo: string;
};

const empty: FormState = { personId: "", authorizedSubject: "", evidence: "", qualifiedFrom: "", qualifiedTo: "" };
const emptyPerson: PersonInput = { fullName: "", employeeCode: "", personType: "INTERNAL", company: "", departmentId: "", jobTitle: "", notes: "" };

export default function TrainersClient({ canManage }: { canManage: boolean }) {
  const [qualifications, setQualifications] = useState<TrainerQualification[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allDocuments, setAllDocuments] = useState<TrainerDocumentMeta[]>([]);
  const [form, setForm] = useState<FormState>(empty);
  const [personForm, setPersonForm] = useState<PersonInput>(emptyPerson);
  const [showNewTrainer, setShowNewTrainer] = useState(false);
  const [formExpanded, setFormExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [currentOnly, setCurrentOnly] = useState(false);
  const [showAnnulled, setShowAnnulled] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [documentsFor, setDocumentsFor] = useState<TrainerQualification["person"]>();
  const [documents, setDocuments] = useState<TrainerDocumentMeta[]>([]);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [retireTarget, setRetireTarget] = useState<TrainerQualification>();
  const [retireDate, setRetireDate] = useState(new Date().toISOString().slice(0, 10));
  const [annulTarget, setAnnulTarget] = useState<TrainerQualification>();
  const [annulReason, setAnnulReason] = useState("");
  const formSectionRef = useRef<HTMLElement>(null);
  const retireSectionRef = useRef<HTMLElement>(null);
  const annulSectionRef = useRef<HTMLElement>(null);
  const documentsSectionRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    const [loadedQualifications, loadedPeople, loadedDepartments, loadedDocuments] = await Promise.all([
      apiJson<TrainerQualification[]>("/api/trainers?includeAnnulled=true"),
      apiJson<Person[]>("/api/people"),
      apiJson<Department[]>("/api/departments?includeInactive=true"),
      canManage ? apiJson<TrainerDocumentMeta[]>("/api/trainers/documents") : Promise.resolve([]),
    ]);
    setQualifications(loadedQualifications);
    setPeople(loadedPeople);
    setDepartments(loadedDepartments);
    setAllDocuments(loadedDocuments);
  }, [canManage]);

  useEffect(() => { void load().catch(() => setError("No se ha podido cargar el registro de formadores.")); }, [load]);

  useEffect(() => {
    if (formExpanded) requestAnimationFrame(() => formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [formExpanded, editingId, showNewTrainer]);
  useEffect(() => {
    if (retireTarget) requestAnimationFrame(() => retireSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [retireTarget]);
  useEffect(() => {
    if (annulTarget) requestAnimationFrame(() => annulSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [annulTarget]);
  useEffect(() => {
    if (documentsFor) requestAnimationFrame(() => documentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [documentsFor]);

  const visible = useMemo(() => qualifications.filter((item) => {
    const term = search.trim().toLocaleLowerCase("es");
    return (!item.annulledAt || showAnnulled)
      && (!currentOnly || item.current)
      && (!typeFilter || item.person.personType === typeFilter)
      && (!term || item.person.fullName.toLocaleLowerCase("es").includes(term)
        || item.authorizedSubject.toLocaleLowerCase("es").includes(term)
        || item.evidence.toLocaleLowerCase("es").includes(term));
  }), [qualifications, currentOnly, showAnnulled, typeFilter, search]);

  const qualifiedPeople = new Set(qualifications.filter((item) => !item.annulledAt).map((item) => item.personId));
  const selectablePeople = people.filter((person) => person.active || person.id === form.personId);
  const documentsByPerson = useMemo(() => {
    const grouped = new Map<string, TrainerDocumentMeta[]>();
    for (const document of allDocuments) grouped.set(document.personId, [...(grouped.get(document.personId) ?? []), document]);
    return grouped;
  }, [allDocuments]);

  async function downloadAnnex() {
    setDownloadBusy(true); setError("");
    try {
      const response = await fetch(`/api/trainers/export?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo generar el Anexo III");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "Listado_Formadores_Cualificados_Anexo_III.docx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo descargar el Anexo III");
    } finally { setDownloadBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    const qualificationCandidate = {
      ...form,
      personId: showNewTrainer && !editingId ? "new-trainer" : form.personId,
      qualifiedTo: form.qualifiedTo || undefined,
    };
    const parsedQualification = trainerQualificationInputSchema.safeParse(qualificationCandidate);
    if (!parsedQualification.success) {
      setError(parsedQualification.error.issues[0]?.message ?? "Datos de cualificación no válidos");
      return;
    }

    const parsedPerson = showNewTrainer && !editingId ? personInputSchema.safeParse(personForm) : undefined;
    if (parsedPerson && !parsedPerson.success) {
      setError(parsedPerson.error.issues[0]?.message ?? "Datos del formador no válidos");
      return;
    }

    setBusy(true); setError("");
    try {
      if (showNewTrainer && !editingId && parsedPerson?.success) {
        const qualification = {
          authorizedSubject: parsedQualification.data.authorizedSubject,
          evidence: parsedQualification.data.evidence,
          qualifiedFrom: parsedQualification.data.qualifiedFrom,
          qualifiedTo: parsedQualification.data.qualifiedTo,
        };
        await apiJson<TrainerQualification>("/api/trainers/qualified-person", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person: parsedPerson.data, qualification }),
        });
        setPersonForm(emptyPerson);
        setShowNewTrainer(false);
      } else {
        await apiJson(editingId ? `/api/trainers/${editingId}` : "/api/trainers", {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsedQualification.data),
        });
      }
      setEditingId(undefined);
      setForm(empty);
      setFormExpanded(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el formador cualificado");
    } finally { setBusy(false); }
  }

  function edit(item: TrainerQualification) {
    setShowNewTrainer(false);
    setFormExpanded(true);
    setRetireTarget(undefined);
    setAnnulTarget(undefined);
    setEditingId(item.id);
    setForm({
      personId: item.personId,
      authorizedSubject: item.authorizedSubject,
      evidence: item.evidence,
      qualifiedFrom: item.qualifiedFrom,
      qualifiedTo: item.qualifiedTo ?? "",
    });
  }

  function openExistingQualificationForm() {
    setEditingId(undefined);
    setShowNewTrainer(false);
    setPersonForm(emptyPerson);
    setForm(empty);
    setRetireTarget(undefined);
    setAnnulTarget(undefined);
    setFormExpanded(true);
  }

  function openNewTrainerForm() {
    setEditingId(undefined);
    setShowNewTrainer(true);
    setPersonForm(emptyPerson);
    setForm(empty);
    setRetireTarget(undefined);
    setAnnulTarget(undefined);
    setFormExpanded(true);
  }

  function closeQualificationForm() {
    setEditingId(undefined);
    setShowNewTrainer(false);
    setPersonForm(emptyPerson);
    setForm(empty);
    setFormExpanded(false);
  }

  async function retireQualification() {
    if (!retireTarget) return;
    setBusy(true); setError("");
    try {
      await apiJson<TrainerQualification>(`/api/trainers/${retireTarget.id}/retire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qualifiedTo: retireDate }),
      });
      setRetireTarget(undefined);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo dar de baja la cualificación");
    } finally { setBusy(false); }
  }

  async function annulQualification() {
    if (!annulTarget) return;
    setBusy(true); setError("");
    try {
      await apiJson<TrainerQualification>(`/api/trainers/${annulTarget.id}/annul`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: annulReason }),
      });
      setAnnulTarget(undefined);
      setAnnulReason("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo anular la cualificación");
    } finally { setBusy(false); }
  }

  async function openDocuments(person: TrainerQualification["person"]) {
    setDocumentsFor(person); setDocumentBusy(true); setError("");
    try { setDocuments(await apiJson<TrainerDocumentMeta[]>(`/api/trainers/documents?personId=${encodeURIComponent(person.id)}`)); }
    catch { setError("No se han podido cargar los documentos adjuntos."); }
    finally { setDocumentBusy(false); }
  }

  async function uploadDocument(file?: File) {
    if (!documentsFor || !file) return;
    setDocumentBusy(true); setError("");
    try {
      const body = new FormData(); body.set("personId", documentsFor.id); body.set("file", file);
      const response = await fetch("/api/trainers/documents", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo adjuntar el archivo");
      await openDocuments(documentsFor);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo adjuntar el archivo"); setDocumentBusy(false); }
  }

  async function removeDocument(id: string) {
    if (!documentsFor) return;
    setDocumentBusy(true); setError("");
    try {
      const response = await fetch(`/api/trainers/documents/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo eliminar el archivo");
      await openDocuments(documentsFor);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo eliminar el archivo"); setDocumentBusy(false); }
  }

  return <div className="trainers-layout">
    {canManage && <section ref={formSectionRef} className="card form-section trainer-collapsible-section">
      <div className="form-section-heading trainer-form-heading">
        <div>
          <h2>{editingId ? "Editar cualificación" : "Gestión de formadores"}</h2>
          <p>{editingId
            ? "Modifica la cualificación seleccionada y guarda los cambios."
            : "Abre solo el formulario que necesites para mantener despejado el listado."}</p>
        </div>
        <div className="button-row trainer-form-mode-buttons">
          {!editingId && <button className={!showNewTrainer && formExpanded ? "secondary trainer-mode-active" : "secondary"} type="button" onClick={openExistingQualificationForm}>Persona existente</button>}
          {!editingId && <button className={showNewTrainer && formExpanded ? "secondary trainer-mode-active" : "secondary"} type="button" onClick={openNewTrainerForm}>Nuevo formador</button>}
          {formExpanded && <button className="tertiary" type="button" onClick={closeQualificationForm}>Cerrar formulario</button>}
        </div>
      </div>

      {formExpanded && <form className="form-grid trainer-expanded-form" onSubmit={submit}>
        {showNewTrainer && !editingId ? <>
          <div className="full-width trainer-form-subheading">
            <strong>Datos del formador</strong>
            <span>Al guardar se creará también su ficha en Personal.</span>
          </div>
          <label>Nombre completo *<input value={personForm.fullName} onChange={(event) => setPersonForm({ ...personForm, fullName: event.target.value })} /></label>
          <label>Tipo *<select value={personForm.personType} onChange={(event) => setPersonForm({ ...personForm, personType: event.target.value as Person["personType"], company: "", departmentId: "" })}><option value="INTERNAL">INTERNO</option><option value="EXTERNAL">EXTERNO</option></select></label>
          <label>Puesto / función *<input value={personForm.jobTitle} onChange={(event) => setPersonForm({ ...personForm, jobTitle: event.target.value })} /></label>
          {personForm.personType === "INTERNAL"
            ? <label>Departamento *<select value={personForm.departmentId ?? ""} onChange={(event) => setPersonForm({ ...personForm, departmentId: event.target.value })}><option value="">Selecciona un departamento</option>{departments.filter((department) => department.active).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            : <label>Empresa / entidad *<input value={personForm.company ?? ""} onChange={(event) => setPersonForm({ ...personForm, company: event.target.value })} /></label>}
          <label>Código empleado <span className="optional-label">Opcional</span><input value={personForm.employeeCode ?? ""} onChange={(event) => setPersonForm({ ...personForm, employeeCode: event.target.value })} /></label>
          <label>Notas <span className="optional-label">Opcional</span><input value={personForm.notes ?? ""} onChange={(event) => setPersonForm({ ...personForm, notes: event.target.value })} /></label>
          <div className="full-width trainer-form-subheading">
            <strong>Primera cualificación</strong>
            <span>Completa la materia autorizada y su evidencia.</span>
          </div>
        </> : <label>Formador *<select disabled={Boolean(editingId)} value={form.personId} onChange={(event) => setForm({ ...form, personId: event.target.value })}><option value="">Selecciona una persona</option>{selectablePeople.map((person) => <option key={person.id} value={person.id}>{person.fullName} · {person.personType === "INTERNAL" ? "INTERNO" : "EXTERNO"}</option>)}</select></label>}

        <label>Fecha de alta *<input type="date" value={form.qualifiedFrom} onChange={(event) => setForm({ ...form, qualifiedFrom: event.target.value })} /></label>
        <label className="full-width">Materia / formación autorizada *<input value={form.authorizedSubject} onChange={(event) => setForm({ ...form, authorizedSubject: event.target.value })} /></label>
        <label className="full-width">Evidencia de cualificación *<textarea value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} /></label>
        <label>Fecha de baja <span className="optional-label">Opcional</span><input type="date" value={form.qualifiedTo} onChange={(event) => setForm({ ...form, qualifiedTo: event.target.value })} /><span className="field-help">En blanco = autorización vigente, una vez alcanzada la fecha de alta.</span></label>
        <div className="form-actions">
          <button disabled={busy}>{busy ? "Guardando…" : editingId ? "Guardar cambios" : showNewTrainer ? "Guardar formador cualificado" : "Añadir cualificación"}</button>
          <button className="secondary" type="button" onClick={closeQualificationForm}>Cancelar</button>
        </div>
      </form>}
    </section>}

    <section className="card filter-card">
      <div className="section-heading"><div><h2>Listado de formadores cualificados</h2><p>{qualifications.length} líneas registradas · {qualifiedPeople.size} formadores.</p></div><div className="button-row">
        <button className="secondary" type="button" disabled={downloadBusy} onClick={() => void downloadAnnex()}>{downloadBusy ? "Generando Word…" : "Descargar Anexo III (Word)"}</button>
        {canManage && <Link className="button-link" href="/administracion/importar-formadores">Importar Anexo III</Link>}
      </div></div>
      <div className="filter-grid trainer-filter-grid">
        <label>Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Formador, materia o evidencia" /></label>
        <label>Tipo<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Todos</option><option value="INTERNAL">Internos</option><option value="EXTERNAL">Externos</option></select></label>
        <label className="checkbox-line"><input type="checkbox" checked={currentOnly} onChange={(event) => setCurrentOnly(event.target.checked)} /> Solo autorizaciones vigentes</label>
        <label className="checkbox-line"><input type="checkbox" checked={showAnnulled} onChange={(event) => setShowAnnulled(event.target.checked)} /> Mostrar registros anulados</label>
      </div>
    </section>

    {error && <div className="form-alert form-alert-error" role="alert"><strong>No se pudo completar la operación</strong><span>{error}</span></div>}

    <section className="card table-card">
      <div className="table-scroll"><table className="responsive-record-table trainer-register-table"><thead><tr><th>Formador cualificado</th><th>Materia / formación autorizada</th><th>Evidencia de cualificación</th><th>Fecha alta</th><th>Fecha baja</th><th>Interno / externo</th><th>Estado</th>{canManage && <th>Documentos adjuntos</th>}{canManage && <th>Acciones</th>}</tr></thead>
      <tbody>{visible.map((item) => {
        const personDocuments = documentsByPerson.get(item.personId) ?? [];
        return <tr key={item.id}>
          <td data-label="Formador cualificado"><strong className="table-primary">{item.person.fullName}</strong>{!item.person.active && <><br /><small>Persona inactiva</small></>}</td>
          <td data-label="Materia / formación autorizada">{item.authorizedSubject}</td><td data-label="Evidencia de cualificación" className="trainer-evidence">{item.evidence}</td>
          <td data-label="Fecha alta">{formatDateEs(item.qualifiedFrom)}</td><td data-label="Fecha baja">{formatDateEs(item.qualifiedTo)}</td>
          <td data-label="Interno / externo"><span className={`badge ${item.person.personType === "EXTERNAL" ? "external" : ""}`}>{item.person.personType === "INTERNAL" ? "INTERNO" : "EXTERNO"}</span></td>
          <td data-label="Estado">{item.annulledAt
            ? <><span className="badge status-danger">ANULADO</span><br /><small>{item.annulmentReason}</small></>
            : item.current
              ? <span className="badge status-executed">VIGENTE</span>
              : item.qualifiedTo
                ? <span className="badge">BAJA</span>
                : <span className="badge">PENDIENTE ALTA</span>}</td>
          {canManage && <td data-label="Documentos adjuntos"><div className="trainer-document-cell">
            <div>{personDocuments.length === 0 ? <span className="muted">Sin adjuntos</span> : personDocuments.slice(0, 2).map((document) => <span className="document-chip" key={document.id}>{document.fileName}</span>)}</div>
            {personDocuments.length > 2 && <small>+{personDocuments.length - 2} más</small>}
            <button className="secondary" type="button" onClick={() => void openDocuments(item.person)}>{personDocuments.length ? `Gestionar (${personDocuments.length})` : "Añadir documento"}</button>
          </div></td>}
          {canManage && <td data-label="Acciones"><div className="trainer-row-actions">
            {!item.annulledAt && <button className="secondary" type="button" onClick={() => edit(item)}>Editar</button>}
            {!item.annulledAt && item.current && <button className="secondary" type="button" onClick={() => { setRetireDate(new Date().toISOString().slice(0, 10)); setRetireTarget(item); setAnnulTarget(undefined); setDocumentsFor(undefined); }}>Dar de baja</button>}
            {!item.annulledAt && <button className="danger" type="button" onClick={() => { setAnnulReason(""); setAnnulTarget(item); setRetireTarget(undefined); setDocumentsFor(undefined); }}>Anular registro</button>}
          </div></td>}
        </tr>;
      })}</tbody></table></div>
      {visible.length === 0 && <p className="muted">No hay cualificaciones que coincidan con los filtros.</p>}
    </section>

    {retireTarget && <section ref={retireSectionRef} className="card trainer-action-panel trainer-scroll-target">
      <div className="section-heading"><div><h2>Dar de baja cualificación</h2><p><strong>{retireTarget.person.fullName}</strong> · {retireTarget.authorizedSubject}</p></div><button className="secondary" type="button" onClick={() => setRetireTarget(undefined)}>Cancelar</button></div>
      <p className="muted">La baja conserva el registro histórico y deja de ofrecer esta cualificación en nuevas formaciones y sesiones a partir de la fecha indicada.</p>
      <div className="form-grid"><label>Fecha de baja *<input type="date" min={retireTarget.qualifiedFrom} value={retireDate} onChange={(event) => setRetireDate(event.target.value)} /></label><div className="form-actions"><button disabled={busy || !retireDate} type="button" onClick={() => void retireQualification()}>{busy ? "Guardando…" : "Confirmar baja"}</button></div></div>
    </section>}

    {annulTarget && <section ref={annulSectionRef} className="card trainer-action-panel trainer-scroll-target">
      <div className="section-heading"><div><h2>Anular registro erróneo</h2><p><strong>{annulTarget.person.fullName}</strong> · {annulTarget.authorizedSubject}</p></div><button className="secondary" type="button" onClick={() => setAnnulTarget(undefined)}>Cancelar</button></div>
      <div className="form-alert form-alert-error"><strong>La anulación no borra la trazabilidad</strong><span>El registro dejará de aparecer en el Anexo III y en las selecciones de formadores, pero permanecerá disponible en el histórico y en auditoría. La persona seguirá existiendo en Personal.</span></div>
      <div className="form-grid"><label className="full-width">Motivo de anulación *<textarea value={annulReason} onChange={(event) => setAnnulReason(event.target.value)} placeholder="Indica por qué este registro se creó por error" /></label><div className="form-actions"><button className="danger" disabled={busy || annulReason.trim().length < 3} type="button" onClick={() => void annulQualification()}>{busy ? "Anulando…" : "Confirmar anulación"}</button></div></div>
    </section>}

    {documentsFor && <section ref={documentsSectionRef} className="card trainer-documents trainer-scroll-target">
      <div className="section-heading"><div><h2>Documentación del formador</h2><p><strong>{documentsFor.fullName}</strong> · Los adjuntos son evidencia complementaria y no se incluyen como columna en el Anexo III.</p></div><button className="secondary" type="button" onClick={() => setDocumentsFor(undefined)}>Cerrar</button></div>
      {canManage && <div className="trainer-upload-box">
        <div><strong>Añadir documento</strong><p className="muted">PDF, Office, TXT/CSV, JPG o PNG. Máximo 10 MB por archivo, 20 archivos y 50 MB por formador.</p></div>
        <label className="button-link trainer-file-button">Seleccionar archivo<input className="trainer-file-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png" disabled={documentBusy} onChange={(event) => { const file = event.target.files?.[0]; void uploadDocument(file); event.currentTarget.value = ""; }} /></label>
      </div>}
      {documentBusy ? <p className="muted">Actualizando documentos…</p> : <div className="trainer-document-list">{documents.map((document) => <div key={document.id} className="trainer-document-row"><div><strong>{document.fileName}</strong><small>{Math.max(1, Math.round(document.sizeBytes / 1024))} KB · añadido el {formatDateEs(document.createdAt)}</small></div><div className="button-row"><a className="button-link secondary-link" href={`/api/trainers/documents/${document.id}`}>Descargar</a>{canManage && <button className="secondary" type="button" onClick={() => void removeDocument(document.id)}>Eliminar</button>}</div></div>)}</div>}
      {!documentBusy && documents.length === 0 && <div className="empty-state"><strong>Sin documentos adjuntos</strong><p>Utiliza “Seleccionar archivo” para incorporar la evidencia del formador.</p></div>}
    </section>}
  </div>;
}
