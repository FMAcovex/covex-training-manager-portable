"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppIcon } from "@/app/components/icons";
import { StatusBadge } from "@/app/components/ui";
import { apiJson, isAbortError } from "@/app/lib/api-client";
import type { Department } from "@/domain/department";
import type { Person } from "@/domain/person";
import type { TrainingCatalogs } from "@/domain/training-catalogs";
import type { Training } from "@/domain/training";

type FilterState = { year: string; search: string; planningType: string; isGmp: string; trainingTypeId: string; originType: string; departmentId: string; trainerPersonId: string; externalTrainerName: string };
const emptyFilters: FilterState = { year: "", search: "", planningType: "", isGmp: "", trainingTypeId: "", originType: "", departmentId: "", trainerPersonId: "", externalTrainerName: "" };

const statusDetails = (status?: Training["globalStatus"]) => status === "EXECUTED"
  ? { label: "Ejecutada", tone: "success" as const }
  : status === "NOT_EXECUTED"
    ? { label: "No ejecutada", tone: "danger" as const }
    : { label: "Pendiente", tone: "warning" as const };

export default function TrainingsClient() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [catalogs, setCatalogs] = useState<TrainingCatalogs>({ trainingTypes: [], modalities: [], evaluationMethods: [] });
  const [historicalCatalogs, setHistoricalCatalogs] = useState<TrainingCatalogs>({ trainingTypes: [], modalities: [], evaluationMethods: [] });
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [knownYears, setKnownYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [optionsError, setOptionsError] = useState("");

  const load = useCallback(async (current: FilterState, signal: AbortSignal) => {
    setLoading(true);
    const query = new URLSearchParams(Object.entries(current).filter(([, value]) => value));
    try {
      const loaded = await apiJson<Training[]>(`/api/trainings?${query}`, { signal });
      setTrainings(loaded);
      setKnownYears((years) => [...new Set([...years, ...loaded.map((training) => training.year)])].sort((a, b) => b - a));
      setListError("");
    } catch (loadError) {
      if (isAbortError(loadError)) return;
      setListError("No se ha podido cargar el listado de formaciones.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      apiJson<TrainingCatalogs>("/api/training-catalogs"),
      apiJson<TrainingCatalogs>("/api/training-catalogs?includeInactive=true"),
      apiJson<Person[]>("/api/people"),
      apiJson<Department[]>("/api/departments"),
    ]).then(([loadedCatalogs, loadedHistoricalCatalogs, loadedPeople, loadedDepartments]) => {
      setCatalogs(loadedCatalogs); setHistoricalCatalogs(loadedHistoricalCatalogs); setPeople(loadedPeople); setDepartments(loadedDepartments);
      setOptionsError("");
    }).catch(() => setOptionsError("No se han podido cargar todas las opciones de consulta."));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const delay = filters.search ? 250 : 0;
    const timeout = window.setTimeout(() => void load(filters, controller.signal), delay);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [filters, load]);

  const update = (key: keyof FilterState, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => setFilters(emptyFilters);
  const error = optionsError || listError;
  const hasFilters = Object.values(filters).some(Boolean);
  const catalogName = (id: string | undefined) => historicalCatalogs.trainingTypes.find((item) => item.id === id)?.name ?? "—";
  const trainerName = (training: Training) => {
    const internalIds = training.plannedTrainerPersonIds?.length ? training.plannedTrainerPersonIds : training.plannedTrainerPersonId ? [training.plannedTrainerPersonId] : [];
    const externalNames = training.externalTrainerNames?.length ? training.externalTrainerNames : training.externalTrainerName ? [training.externalTrainerName] : [];
    const names = [
      ...internalIds.map((id) => people.find((person) => person.id === id)?.fullName).filter((name): name is string => Boolean(name)),
      ...externalNames,
    ];
    return names.join(", ") || "—";
  };

  return <>
    <section className="card filter-card">
      <div className="section-heading">
        <div><h2>Buscar y filtrar</h2><p>Acota el listado por los criterios que necesites.</p></div>
        {hasFilters && <button className="tertiary" type="button" onClick={clearFilters}>Limpiar filtros</button>}
      </div>
      <div className="filter-grid">
        <label>Año<select value={filters.year} onChange={(event) => update("year", event.target.value)}><option value="">Todos</option>{knownYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>Nombre o código<input placeholder="Buscar formación" value={filters.search} onChange={(event) => update("search", event.target.value)} /></label>
        <label>Planificación<select value={filters.planningType} onChange={(event) => update("planningType", event.target.value)}><option value="">Todas</option><option value="PLANNED">Planificada</option><option value="UNPLANNED">No planificada</option></select></label>
        <label>GMP<select value={filters.isGmp} onChange={(event) => update("isGmp", event.target.value)}><option value="">Todos</option><option value="true">Sí</option><option value="false">No</option></select></label>
        <label>Tipo<select value={filters.trainingTypeId} onChange={(event) => update("trainingTypeId", event.target.value)}><option value="">Todos</option>{catalogs.trainingTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Origen<select value={filters.originType} onChange={(event) => update("originType", event.target.value)}><option value="">Todos</option><option value="INTERNAL">Interna</option><option value="EXTERNAL">Externa</option></select></label>
        <label>Departamento destinatario<select value={filters.departmentId} onChange={(event) => update("departmentId", event.target.value)}><option value="">Todos</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Formador<select value={filters.trainerPersonId} onChange={(event) => update("trainerPersonId", event.target.value)}><option value="">Todos</option>{people.filter((person) => person.active).map((person) => <option key={person.id} value={person.id}>{person.fullName} · {person.personType === "INTERNAL" ? "INTERNO" : "EXTERNO"}</option>)}</select></label>
        <label>Nombre externo histórico<input placeholder="Solo registros antiguos" value={filters.externalTrainerName} onChange={(event) => update("externalTrainerName", event.target.value)} /></label>
      </div>
    </section>

    {error && <div className="form-alert form-alert-error" role="alert"><strong>No se ha podido completar la consulta</strong><span>{error}</span></div>}

    <section className="card table-card" aria-busy={loading}>
      <div className="section-heading table-heading">
        <div><h2>Formaciones</h2><p>{loading ? "Actualizando resultados…" : `${trainings.length} ${trainings.length === 1 ? "formación encontrada" : "formaciones encontradas"}`}</p></div>
      </div>
      {loading && trainings.length === 0 ? <div className="loading-state"><span className="loading-spinner" /><span>Cargando formaciones…</span></div> : <>
        <div className="table-scroll"><table><thead><tr><th>Código</th><th>Curso</th><th>Año</th><th>Estado</th><th>Planificación</th><th>GMP</th><th>Tipo</th><th>Origen</th><th>Formador previsto</th></tr></thead><tbody>{trainings.map((training) => {
          const currentStatus = statusDetails(training.globalStatus);
          return <tr key={training.id}><td><Link className="record-link" href={`/formaciones/${training.id}`}>{training.code}</Link></td><td><strong className="table-primary">{training.name}</strong></td><td>{training.year}</td><td><StatusBadge tone={currentStatus.tone}>{currentStatus.label}</StatusBadge></td><td><StatusBadge>{training.planningType === "PLANNED" ? "Planificada" : "No planificada"}</StatusBadge></td><td>{training.isGmp ? "Sí" : "No"}</td><td>{catalogName(training.trainingTypeId)}</td><td>{training.originType === "INTERNAL" ? "Interna" : "Externa"}</td><td>{trainerName(training)}</td></tr>;
        })}</tbody></table></div>
        {trainings.length === 0 && <div className="empty-state compact"><AppIcon name="training" /><strong>Sin resultados</strong><span>Prueba a cambiar o limpiar los filtros de búsqueda.</span></div>}
      </>}
    </section>
  </>;
}
