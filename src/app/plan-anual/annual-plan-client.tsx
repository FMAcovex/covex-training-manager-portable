"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppIcon } from "@/app/components/icons";
import { StatusBadge } from "@/app/components/ui";
import { ApiClientError, apiJson, isAbortError } from "@/app/lib/api-client";
import { formatDateEs } from "@/app/lib/format";
import type { AnnualPlan, AnnualPlanRow } from "@/annual-plan/types";
import type { TrainingCatalogs } from "@/domain/training-catalogs";

type Filters = { search: string; status: string; isGmp: string; originType: string; trainingTypeId: string };
const emptyFilters: Filters = { search: "", status: "", isGmp: "", originType: "", trainingTypeId: "" };
const status = (value: AnnualPlanRow["status"]) => value === "EXECUTED" ? "Ejecutada" : value === "NOT_EXECUTED" ? "No ejecutada" : "Pendiente";

export default function AnnualPlanClient({ canGenerate, availableYears }: { canGenerate: boolean; availableYears: number[] }) {
  const [year, setYear] = useState(availableYears[0] ?? new Date().getFullYear());
  const [filters, setFilters] = useState(emptyFilters);
  const [plan, setPlan] = useState<AnnualPlan>();
  const [catalogs, setCatalogs] = useState<TrainingCatalogs>({ trainingTypes: [], modalities: [], evaluationMethods: [] });
  const [planError, setPlanError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [generating, setGenerating] = useState(false);
  const load = useCallback(async (selectedYear: number, selectedFilters: Filters, signal: AbortSignal) => {
    const entries = Object.entries(selectedFilters).filter(([, value]) => value);
    const query = new URLSearchParams({ year: String(selectedYear), ...Object.fromEntries(entries) });
    try {
      const result = await apiJson<AnnualPlan>(`/api/annual-plan?${query}`, { signal });
      setPlanError(""); setPlan(result);
    } catch (loadError) {
      if (isAbortError(loadError)) return;
      setPlanError(loadError instanceof ApiClientError ? loadError.message : "No se pudo cargar el Plan");
    }
  }, []);
  useEffect(() => { void apiJson<TrainingCatalogs>("/api/training-catalogs").then((loaded) => { setCatalogs(loaded); setCatalogError(""); }).catch(() => setCatalogError("No se han podido cargar los tipos de formación.")); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const delay = filters.search ? 250 : 0;
    const timeout = window.setTimeout(() => void load(year, filters, controller.signal), delay);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [filters, load, year]);
  const update = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  async function generate() {
    setGenerating(true); setGenerationError("");
    try {
      const response = await fetch(`/api/annual-plan/${year}/annex-iv`, { method: "POST" });
      if (!response.ok) {
        const result = await response.json().catch(() => undefined) as { error?: string } | undefined;
        setGenerationError(result?.error ?? "No se pudo generar el Anexo IV");
        return;
      }
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = `Anexo_IV_Plan_Formacion_${year}.pdf`; link.click(); URL.revokeObjectURL(url);
    } catch {
      setGenerationError("No se ha podido conectar con el servidor para generar el Anexo IV.");
    } finally { setGenerating(false); }
  }
  const error = catalogError || planError || generationError;
  return <>
    <section className="card filter-card"><div className="section-heading"><div><h2>Consulta del plan</h2><p>Selecciona el ejercicio y aplica filtros sobre las formaciones.</p></div>{canGenerate && <button disabled={generating} onClick={generate}>{generating ? "Generando…" : "Generar Anexo IV"}</button>}</div><div className="filter-grid">
      <label>Año<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{availableYears.length ? availableYears.map((item) => <option key={item} value={item}>{item}</option>) : <option value={year}>{year}</option>}</select></label>
      <label>Nombre<input value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Buscar formación" /></label>
      <label>Estado<select value={filters.status} onChange={(event) => update("status", event.target.value)}><option value="">Todos</option><option value="PENDING">Pendiente</option><option value="EXECUTED">Ejecutada</option><option value="NOT_EXECUTED">No ejecutada</option></select></label>
      <label>GMP<select value={filters.isGmp} onChange={(event) => update("isGmp", event.target.value)}><option value="">Todos</option><option value="true">GMP</option><option value="false">No GMP</option></select></label>
      <label>Origen<select value={filters.originType} onChange={(event) => update("originType", event.target.value)}><option value="">Todos</option><option value="INTERNAL">Interna</option><option value="EXTERNAL">Externa</option></select></label>
      <label>Tipo<select value={filters.trainingTypeId} onChange={(event) => update("trainingTypeId", event.target.value)}><option value="">Todos</option>{catalogs.trainingTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </div>{error && <p className="error" role="alert">{error}</p>}</section>
    {plan && <><section className="summary-grid" aria-label="Resumen del plan"><article className="summary-card"><span>Planificadas</span><strong>{plan.summary.totalPlanned}</strong></article><article className="summary-card"><span>Ejecutadas</span><strong>{plan.summary.plannedExecuted}</strong></article><article className="summary-card"><span>Ejecución</span><strong>{plan.summary.executionPercentage === null ? "—" : `${plan.summary.executionPercentage.toFixed(1)}%`}</strong></article><article className="summary-card"><span>Pendientes</span><strong>{plan.summary.pendingPlanned}</strong></article><article className="summary-card"><span>No planificadas ejecutadas</span><strong>{plan.summary.unplannedExecuted}</strong></article></section><PlanTable title="Planificadas" rows={plan.planned} /><PlanTable title="No planificadas" rows={plan.unplanned} /></>}
  </>;
}

function PlanTable({ title, rows }: { title: string; rows: AnnualPlanRow[] }) {
  return <section className="card table-card"><div className="section-heading table-heading"><div><h2>{title}</h2><p>{rows.length} {rows.length === 1 ? "registro" : "registros"}</p></div></div><div className="table-scroll"><table className="responsive-record-table annual-plan-table"><thead><tr><th>Curso</th><th>Fecha prevista</th><th>Fecha real</th><th>Estado</th><th>GMP</th><th>Tipo/origen</th><th>Formador</th><th>Duración</th><th>Colectivo</th><th>Motivo / justificación</th><th>Acciones</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td data-label="Curso"><strong className="table-primary">{row.course}</strong><br /><small>{row.sessionCode ?? `${row.trainingCode} · sin sesión`}</small></td><td data-label="Fecha prevista">{formatDateEs(row.plannedDate)}</td><td data-label="Fecha real">{formatDateEs(row.executionDate)}</td><td data-label="Estado"><StatusBadge tone={row.status === "EXECUTED" ? "success" : row.status === "NOT_EXECUTED" ? "danger" : "warning"}>{status(row.status)}</StatusBadge></td><td data-label="GMP">{row.isGmp ? "Sí" : "No"}</td><td data-label="Tipo / origen">{row.trainingType || "—"}<br /><small>{row.originType === "INTERNAL" ? "Interna" : "Externa"}</small></td><td data-label="Formador">{row.trainer || "—"}</td><td data-label="Duración">{row.durationMinutes ? `${row.durationMinutes} min` : "—"}</td><td data-label="Colectivo">{row.targetGroup || "—"}</td><td data-label="Motivo / justificación">{row.nonExecutionReason || row.reason || "—"}</td><td data-label="Acciones"><Link className="record-link" href={`/formaciones/${row.trainingId}`}>Ver ficha</Link></td></tr>)}</tbody></table></div>{rows.length === 0 && <div className="empty-state compact"><AppIcon name="calendar" /><strong>Sin registros</strong><span>No hay formaciones para los filtros seleccionados.</span></div>}</section>;
}
