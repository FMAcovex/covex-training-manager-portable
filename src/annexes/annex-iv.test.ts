import { describe, expect, it } from "vitest";
import { demoAnnexIVTemplate } from "@/annexes/annex-repository";
import { AnnexIVDataBuilder } from "@/annexes/annex-iv-data-builder";
import { AnnexIVTemplateAdapter } from "@/annexes/annex-iv-template-adapter";
import { AnnexIVRenderer } from "@/annexes/annex-iv-renderer";
import { AnnexIVDocumentValidator } from "@/annexes/annex-iv-validator";
import type { AnnualPlan, AnnualPlanRow } from "@/annual-plan/types";

const row = (id: string, partial: Partial<AnnualPlanRow> = {}): AnnualPlanRow => {
  const status = partial.status ?? "PENDING";
  return { id, trainingId: id, sessionId: `s-${id}`, trainingCode: `FOR-2026-${id.padStart(4, "0")}`, sessionCode: `FOR-2026-${id.padStart(4, "0")}-S01`, course: `Formación ficticia ${id}`, year: 2026, planningType: "PLANNED", trainingTypeId: "type-quality", trainingType: "Calidad", isGmp: false, originType: "INTERNAL", durationMinutes: 90, targetGroup: "Calidad", plannedDate: "2026-05-01", trainer: "Persona Formadora Ficticia", status, sessionStatus: partial.sessionStatus ?? status, attendedCount: 0, provisional: false, updatedAt: "2026-05-01T10:00:00Z", ...partial };
};
const plan = (planned: AnnualPlanRow[], unplanned: AnnualPlanRow[] = []): AnnualPlan => ({ year: 2026, planned, unplanned, summary: { totalPlanned: planned.length, plannedExecuted: planned.filter((item) => item.status === "EXECUTED").length, executionPercentage: planned.length ? planned.filter((item) => item.status === "EXECUTED").length / planned.length * 100 : null, unplannedExecuted: unplanned.filter((item) => item.status === "EXECUTED").length, pendingPlanned: planned.filter((item) => item.status === "PENDING").length, allPlannedDelivered: planned.length ? planned.every((item) => item.status === "EXECUTED") : null, lastUpdated: planned.concat(unplanned).map((item) => item.updatedAt).sort().at(-1) } });

describe("Anexo IV", () => {
  it("mapea estados, horas, fecha de ejecución y textos sin estados ingleses", () => { const data = new AnnexIVDataBuilder().build(plan([row("1", { status: "EXECUTED", durationMinutes: 90, executionDate: "2026-05-03" }), row("2", { status: "NOT_EXECUTED", nonExecutionReason: "Justificación íntegra" })]), demoAnnexIVTemplate); expect(data.planned[0]).toMatchObject({ durationHours: "1,5", status: "EJECUTADA", executionDate: "03/05/2026" }); expect(data.planned[1].executionDate).toBe(""); expect(data.planned[1].status).toBe("NO EJECUTADA"); expect(data.observations[0]).toContain("Justificación íntegra"); });
  it("conserva fecha real de una sesión ejecutada aunque la formación global siga pendiente", () => {
    const data = new AnnexIVDataBuilder().build(plan([row("1", { status: "PENDING", sessionStatus: "EXECUTED", executionDate: "2026-05-03" })]), demoAnnexIVTemplate);
    expect(data.planned[0]).toMatchObject({ status: "PENDIENTE", executionDate: "03/05/2026" });
  });
  it("excluye no planificada pendiente e incluye ejecutada", () => { const data = new AnnexIVDataBuilder().build(plan([], [row("1", { planningType: "UNPLANNED", reason: "Pendiente", status: "PENDING" }), row("2", { planningType: "UNPLANNED", reason: "Ejecutada", status: "EXECUTED" })]), demoAnnexIVTemplate); expect(data.unplannedExecuted).toHaveLength(1); expect(data.unplannedExecuted[0].reason).toBe("Ejecutada"); });
  it("conserva fecha de emisión inicial vacía y eficacia manual", () => { const data = new AnnexIVDataBuilder().build(plan([]), demoAnnexIVTemplate); expect(data.initialIssueDate).toBe(""); expect(data.summary.effectiveness).toBe("SI / NO"); expect(data.summary.executionPercentage).toBe(""); });
  it("presenta el porcentaje coherente con planificadas ejecutadas y evita valores no finitos", () => {
    const twoOfThree = new AnnexIVDataBuilder().build(plan([row("1", { status: "EXECUTED" }), row("2", { status: "EXECUTED" }), row("3")]), demoAnnexIVTemplate);
    const noneOfOne = new AnnexIVDataBuilder().build(plan([row("1")]), demoAnnexIVTemplate);
    const empty = new AnnexIVDataBuilder().build(plan([]), demoAnnexIVTemplate);
    expect(twoOfThree.summary.executionPercentage).toBe("66,7%");
    expect(noneOfOne.summary.executionPercentage).toBe("0%");
    expect(empty.summary.executionPercentage).toBe("");
  });
  it("genera PDF A4 landscape corto con resumen", () => { const data = new AnnexIVDataBuilder().build(plan([row("1", { status: "EXECUTED" }), row("2")], [row("3", { planningType: "UNPLANNED", reason: "Sobrevenida", status: "EXECUTED" })]), demoAnnexIVTemplate); const renderPlan = new AnnexIVTemplateAdapter().createRenderPlan(data); const bytes = new AnnexIVRenderer().render(renderPlan); const result = new AnnexIVDocumentValidator().validate(bytes, renderPlan); expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF"); expect(renderPlan.template.page.width).toBeGreaterThan(renderPlan.template.page.height); expect(result.plannedRows).toBe(2); expect(result.unplannedRows).toBe(1); });
  it("pagina todas las filas sin crear páginas vacías", () => { const rows = Array.from({ length: 48 }, (_, index) => row(String(index + 1))); const data = new AnnexIVDataBuilder().build(plan(rows), demoAnnexIVTemplate); const renderPlan = new AnnexIVTemplateAdapter().createRenderPlan(data); const result = new AnnexIVDocumentValidator().validate(new AnnexIVRenderer().render(renderPlan), renderPlan); expect(result.pageCount).toBeGreaterThan(1); expect(renderPlan.pages.every((page) => page.blocks.length > 0)).toBe(true); expect(result.plannedRows).toBe(48); });
  it("mide y conserva textos largos, acentos, ñ y W/M", () => { const long = "WWW Formación muy extensa con ñ y acentos para personal de Producción y Calidad ".repeat(5); const data = new AnnexIVDataBuilder().build(plan([row("1", { course: long, targetGroup: long, trainer: long, status: "NOT_EXECUTED", nonExecutionReason: long })]), demoAnnexIVTemplate); const renderPlan = new AnnexIVTemplateAdapter().createRenderPlan(data); const result = new AnnexIVDocumentValidator().validate(new AnnexIVRenderer().render(renderPlan), renderPlan); expect(result.maximumOverflow).toBe(0); expect(result.observationLines).toBeGreaterThan(1); });
  it("mantiene las proporciones controladas de nueve columnas", () => { const widths = new AnnexIVTemplateAdapter().createRenderPlan(new AnnexIVDataBuilder().build(plan([]), demoAnnexIVTemplate)).template.columnWidths; expect(widths).toHaveLength(9); expect(widths[7]).toBeGreaterThan(widths[1]); });
});
