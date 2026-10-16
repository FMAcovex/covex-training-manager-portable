import type { AnnualPlan } from "@/annual-plan/types";
import { formatDurationHours, formatSpanishDate } from "@/annexes/annex-formatting";
import type { AnnexIVData, AnnexIVPlannedRow, AnnexIVUnplannedRow, TemplateVersion } from "@/annexes/types";

const statusText = (status: string): AnnexIVPlannedRow["status"] => status === "EXECUTED" ? "EJECUTADA" : status === "NOT_EXECUTED" ? "NO EJECUTADA" : "PENDIENTE";

export class AnnexIVDataBuilder {
  build(plan: AnnualPlan, templateVersion: TemplateVersion): AnnexIVData {
    const common = (row: AnnualPlan["planned"][number]) => ({
      course: row.course,
      gmp: row.isGmp ? "SI" as const : "NO" as const,
      origin: row.originType === "INTERNAL" ? "INTERNA" as const : "EXTERNA" as const,
      durationHours: formatDurationHours(row.durationMinutes),
      targetGroup: row.targetGroup,
      plannedDate: formatSpanishDate(row.plannedDate),
      executionDate: row.sessionStatus === "EXECUTED" ? formatSpanishDate(row.executionDate) : "",
      trainer: row.trainer,
    });
    const planned: AnnexIVPlannedRow[] = plan.planned.map((row) => ({ ...common(row), status: statusText(row.status) }));
    const unplannedExecuted: AnnexIVUnplannedRow[] = plan.unplanned.filter((row) => row.status === "EXECUTED").map((row) => ({ ...common(row), reason: row.reason ?? "" }));
    const observations = plan.planned.filter((row) => row.status === "NOT_EXECUTED" && row.nonExecutionReason).map((row) => `${row.course} (${formatSpanishDate(row.plannedDate)}): ${row.nonExecutionReason}`);
    return {
      templateVersion,
      year: plan.year,
      initialIssueDate: "",
      planned,
      unplannedExecuted,
      summary: {
        totalPlanned: plan.summary.totalPlanned,
        plannedExecuted: plan.summary.plannedExecuted,
        executionPercentage: plan.summary.executionPercentage === null ? "" : `${Number(plan.summary.executionPercentage.toFixed(1)).toLocaleString("es-ES")}%`,
        unplannedExecuted: unplannedExecuted.length,
        lastUpdated: formatSpanishDate(plan.summary.lastUpdated),
        pendingPlanned: plan.summary.pendingPlanned,
        allPlannedDelivered: plan.summary.allPlannedDelivered === null ? "" : plan.summary.allPlannedDelivered ? "SI" : "NO",
        effectiveness: "SI / NO",
      },
      observations,
    };
  }
}
