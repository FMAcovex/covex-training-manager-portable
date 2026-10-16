"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppIcon } from "@/app/components/icons";
import { StatCard, StatusBadge } from "@/app/components/ui";
import type { IntegrityIssue, IntegrityIssueCode, TrainingIntegrityReport } from "@/integrity/types";

type Filters = { year: string; status: string; departmentId: string; issueType: string };
const emptyFilters: Filters = { year: "", status: "", departmentId: "", issueType: "" };
const statusLabel = { PENDING: "Pendiente", EXECUTED: "Ejecutada", NOT_EXECUTED: "No ejecutada" } as const;

export default function IntegrityReviewClient({ report }: { report: TrainingIntegrityReport }) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const departments = useMemo(() => new Map(report.filters.departments.map((department) => [department.id, department])), [report.filters.departments]);
  const visibleIssues = useMemo(() => report.issues.filter((issue) =>
    (!filters.year || issue.year === Number(filters.year))
    && (!filters.status || issue.trainingStatus === filters.status)
    && (!filters.departmentId || issue.departmentIds.includes(filters.departmentId))
    && (!filters.issueType || issue.code === filters.issueType)
  ), [filters, report.issues]);
  const visibleBreakdown = useMemo(() => {
    const groups = new Map<IntegrityIssueCode, { label: string; count: number; errorCount: number; warningCount: number }>();
    for (const issue of visibleIssues) {
      const current = groups.get(issue.code) ?? { label: issue.title, count: 0, errorCount: 0, warningCount: 0 };
      current.count += 1;
      if (issue.severity === "ERROR") current.errorCount += 1;
      else current.warningCount += 1;
      groups.set(issue.code, current);
    }
    return [...groups.entries()].map(([code, values]) => ({ code, ...values })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
  }, [visibleIssues]);
  const hasFilters = Object.values(filters).some(Boolean);
  const update = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  return <>
    <section className="integrity-readonly-note" aria-label="Alcance de la revisión">
      <AppIcon name="alert" />
      <div><strong>Herramienta de solo lectura</strong><span>Detecta y enlaza incidencias; no completa valores ni modifica expedientes.</span></div>
    </section>

    <section className="dashboard-stats integrity-stats" aria-label="Resumen de integridad">
      <StatCard label="Formaciones revisadas" value={report.summary.totalTrainings} detail={`${report.summary.reviewedSessions} sesiones revisadas`} icon={<AppIcon name="layers" />} />
      <StatCard label="Completas" value={report.summary.completeTrainings} detail="Sin incidencias detectadas" icon={<AppIcon name="check" />} tone="success" />
      <StatCard label="Con avisos" value={report.summary.warningTrainings} detail="Avisos sin errores" icon={<AppIcon name="clock" />} tone="warning" />
      <StatCard label="Con errores" value={report.summary.errorTrainings} detail="Al menos un error" icon={<AppIcon name="alert" />} tone="neutral" />
    </section>
    <p className="integrity-summary-note">El resumen clasifica cada formación una sola vez: los errores prevalecen sobre los avisos. Los filtros se aplican al desglose y al listado.</p>

    <section className="card filter-card">
      <div className="section-heading">
        <div><h2>Filtrar incidencias</h2><p>{visibleIssues.length} de {report.summary.totalIssues} incidencias visibles.</p></div>
        {hasFilters && <button className="tertiary" type="button" onClick={() => setFilters(emptyFilters)}>Limpiar filtros</button>}
      </div>
      <div className="filter-grid integrity-filter-grid">
        <label>Año<select value={filters.year} onChange={(event) => update("year", event.target.value)}><option value="">Todos</option>{report.filters.years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>Estado de formación<select value={filters.status} onChange={(event) => update("status", event.target.value)}><option value="">Todos</option>{report.filters.statuses.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label>
        <label>Departamento<select value={filters.departmentId} onChange={(event) => update("departmentId", event.target.value)}><option value="">Todos</option>{report.filters.departments.map((department) => <option key={department.id} value={department.id}>{department.name}{department.active ? "" : " (inactivo)"}</option>)}</select></label>
        <label>Tipo de incidencia<select value={filters.issueType} onChange={(event) => update("issueType", event.target.value)}><option value="">Todos</option>{report.breakdown.map((item) => <option key={item.code} value={item.code}>{item.label} ({item.count})</option>)}</select></label>
      </div>
    </section>

    <section className="card table-card integrity-breakdown">
      <div className="section-heading table-heading"><div><h2>Desglose por tipo</h2><p>Recuento correspondiente a los filtros actuales.</p></div></div>
      {visibleBreakdown.length > 0 ? <div className="table-scroll"><table><thead><tr><th>Tipo de incidencia</th><th>Total</th><th>Errores</th><th>Avisos</th></tr></thead><tbody>{visibleBreakdown.map((item) => <tr key={item.code}><td><strong className="table-primary">{item.label}</strong></td><td>{item.count}</td><td>{item.errorCount || "—"}</td><td>{item.warningCount || "—"}</td></tr>)}</tbody></table></div> : <p className="muted">No hay incidencias para los filtros seleccionados.</p>}
    </section>

    <section className="card table-card integrity-issues">
      <div className="section-heading table-heading"><div><h2>Listado de incidencias</h2><p>Los enlaces abren el expediente que debe revisarse manualmente.</p></div><div className="integrity-totals"><StatusBadge tone="danger">{visibleIssues.filter((issue) => issue.severity === "ERROR").length} errores</StatusBadge><StatusBadge tone="warning">{visibleIssues.filter((issue) => issue.severity === "WARNING").length} avisos</StatusBadge></div></div>
      {visibleIssues.length > 0 ? <div className="table-scroll"><table><thead><tr><th>Nivel</th><th>Incidencia</th><th>Expediente</th><th>Estado</th><th>Departamento</th><th>Acción</th></tr></thead><tbody>{visibleIssues.map((issue) => <IssueRow issue={issue} departmentNames={issue.departmentIds.map((id) => departments.get(id)?.name).filter((name): name is string => Boolean(name))} key={issue.id} />)}</tbody></table></div> : <div className="empty-state compact"><AppIcon name="check" /><strong>Sin incidencias</strong><span>No hay resultados para los filtros seleccionados.</span></div>}
    </section>
  </>;
}

function IssueRow({ issue, departmentNames }: { issue: IntegrityIssue; departmentNames: string[] }) {
  const record = issue.sessionCode
    ? <><strong>{issue.sessionCode}</strong><small>{issue.trainingCode && issue.trainingName ? `${issue.trainingCode} · ${issue.trainingName}` : "Sin formación asociada"}</small></>
    : <><strong>{issue.trainingCode ?? "Sesión huérfana"}</strong><small>{issue.trainingName ?? issue.sessionCode ?? "Sin formación asociada"}</small></>;
  return <tr className={issue.severity === "ERROR" ? "integrity-row-error" : "integrity-row-warning"}>
    <td><StatusBadge tone={issue.severity === "ERROR" ? "danger" : "warning"}>{issue.severity === "ERROR" ? "ERROR" : "AVISO"}</StatusBadge></td>
    <td><div className="integrity-issue-copy"><strong>{issue.title}</strong><span>{issue.message}</span>{issue.referenceDisposition && <small className={issue.referenceDisposition === "HISTORICAL_VALID" ? "reference-historical" : "reference-review"}>{issue.referenceDisposition === "HISTORICAL_VALID" ? "Histórico válido" : "Revisar antes de continuar"}</small>}</div></td>
    <td><div className="integrity-record">{record}</div></td>
    <td>{issue.trainingStatus ? <StatusBadge tone={issue.trainingStatus === "EXECUTED" ? "success" : issue.trainingStatus === "NOT_EXECUTED" ? "danger" : "warning"}>{statusLabel[issue.trainingStatus]}</StatusBadge> : "—"}</td>
    <td>{departmentNames.length ? departmentNames.join(", ") : "—"}</td>
    <td><Link className="button-link secondary-link integrity-open-link" href={issue.href}>{issue.entityType === "SESSION" ? "Abrir sesión" : "Abrir formación"}</Link></td>
  </tr>;
}
