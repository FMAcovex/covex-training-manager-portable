import { describe, expect, it } from "vitest";
import { demoAnnexIIITemplate } from "@/annexes/annex-repository";
import { AnnexIIIRH0000305TestAdapter, maximumLineOverflow, wrapText } from "@/annexes/annex-iii-template-adapter";
import { measureTextWidth } from "@/annexes/pdf-font-metrics";
import { DocumentValidator } from "@/annexes/document-validator";
import { PdfDocumentRenderer } from "@/annexes/pdf-document-renderer";
import type { AnnexIIIData } from "@/annexes/types";

const adapter = new AnnexIIIRH0000305TestAdapter();
const renderer = new PdfDocumentRenderer();
const validator = new DocumentValidator();
const data = (count: number, long = false): AnnexIIIData => ({
  templateVersion: demoAnnexIIITemplate,
  date: "20/09/2026",
  trainingName: long ? "Formación ficticia con un nombre deliberadamente largo para validar el ajuste de texto" : "Formación ficticia",
  trainer: "Formador Ficticio",
  materialReference: "MAT-TEST-01",
  trainingType: "Tipo ficticio",
  modality: "Presencial",
  reason: "",
  targetGroup: "Departamento ficticio",
  content: long ? "Contenido ficticio extenso ".repeat(24) : "Contenido ficticio",
  observations: "Observación ficticia",
  attendees: Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    employeeName: long ? `Persona Ficticia ${index + 1} con nombre compuesto especialmente largo` : `Persona Ficticia ${index + 1}`,
    department: long ? "Departamento Ficticio de Operaciones y Validación" : "Calidad Ficticia",
    jobTitle: long ? "Especialista Ficticio/a en Procesos y Operaciones" : "Técnico/a",
    signature: "" as const,
    result: index % 2 ? "NO APTO" as const : "APTO" as const,
  })),
});

describe("adaptador y render PDF del Anexo III", () => {
  it("genera una página para tres asistentes", () => expect(adapter.createRenderPlan(data(3)).pages).toHaveLength(1));
  it("calibra el formato base para dieciséis asistentes normales en una página", () => expect(adapter.createRenderPlan(data(16)).pages).toHaveLength(1));
  it.each([
    [13, 1],
    [14, 1],
    [16, 1],
    [18, 2],
    [19, 2],
  ])("pagina %i asistentes normales en %i página(s) sin páginas de asistentes vacías", (count, expectedPages) => {
    const plan = adapter.createRenderPlan(data(count));
    expect(plan.pages).toHaveLength(expectedPages);
    expect(plan.pages.filter((page) => page.kind === "ATTENDEES").every((page) => page.rows.length > 0)).toBe(true);
    expect(plan.pages.at(-1)?.rows.length).toBeGreaterThan(0);
    expect(plan.pages.at(-1)?.showFooter).toBe(true);
  });
  it("permite una tabla sin filas únicamente cuando la sesión no tiene asistentes", () => { const plan = adapter.createRenderPlan(data(0)); expect(plan.attendeeCount).toBe(0); expect(plan.pages).toHaveLength(1); expect(plan.pages[0]).toMatchObject({ rows: [], showFooter: true }); expect(() => validator.validatePdf(renderer.render(plan), plan)).not.toThrow(); });
  it("genera varias páginas para una lista grande", () => expect(adapter.createRenderPlan(data(55)).pages.length).toBeGreaterThan(1));
  it("no pierde asistentes al paginar", () => { const plan = adapter.createRenderPlan(data(55)); expect(plan.renderedNumbers).toHaveLength(55); });
  it("mantiene numeración continua entre páginas", () => { const plan = adapter.createRenderPlan(data(55)); expect(plan.renderedNumbers).toEqual(Array.from({ length: 55 }, (_, index) => index + 1)); });
  it("aumenta la altura para nombres y puestos largos", () => { const plan = adapter.createRenderPlan(data(3, true)); expect(plan.pages[0].rows.some((row) => row.height > 24)).toBe(true); });
  it("no crea filas ficticias vacías", () => { const plan = adapter.createRenderPlan(data(3)); expect(plan.pages.flatMap((page) => page.rows)).toHaveLength(3); });
  it("no genera una página vacía extra", () => { const plan = adapter.createRenderPlan(data(3)); expect(plan.pages.at(-1)?.rows).toHaveLength(3); });
  it("conserva textos fijos, referencia y definición del bloque de contenido", () => { const plan = adapter.createRenderPlan(data(1)); expect(plan.template.fixedText).toMatchObject({ annexReference: expect.stringContaining("RH-00/003/05"), content: "CONTENIDO DE LA FORMACIÓN" }); });
  it("produce bytes PDF válidos y tamaño A4", () => { const plan = adapter.createRenderPlan(data(3)); const bytes = renderer.render(plan); expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF"); expect(validator.validatePdf(bytes, plan)).toMatchObject({ pageCount: 1, attendeeCount: 3, maximumLineOverflow: 0 }); });
  it("valida un PDF multipágina", () => { const plan = adapter.createRenderPlan(data(55)); const result = validator.validatePdf(renderer.render(plan), plan); expect(result.pageCount).toBeGreaterThan(1); expect(result.attendeeCount).toBe(55); });
  it("muestra el contador numérico X de N sin el prefijo Página", () => { const plan = adapter.createRenderPlan(data(55)); const source = Buffer.from(renderer.render(plan)).toString("latin1"); expect(source).toContain("(1 de 3)"); expect(source).toContain("(3 de 3)"); expect(source).not.toContain("(Página "); });
  it("mide glifos anchos W/M en vez de estimar por caracteres", () => { expect(measureTextWidth("WWWW", 8)).toBeGreaterThan(measureTextWidth("iiii", 8)); const lines = wrapText("WWWWWWWW MMMMMMMM", 38, 8); expect(lines.every((line) => measureTextWidth(line, 8) <= 38)).toBe(true); });
  it("ajusta W/M en nombre de formación, empleado, departamento y puesto largo", () => { const value = data(1); value.trainingName = "W".repeat(90); value.attendees[0].employeeName = "W".repeat(100); value.attendees[0].department = "M".repeat(100); value.attendees[0].jobTitle = "Responsable ficticio/a de procesos operativos extraordinariamente largos con WWW MMM"; const plan = adapter.createRenderPlan(value); expect(maximumLineOverflow(plan)).toBe(0); expect(plan.pages.flatMap((page) => page.rows)).toHaveLength(1); expect(() => validator.validatePdf(renderer.render(plan), plan)).not.toThrow(); });
  it("pagina el contenido completo sin truncarlo", () => { const value = data(4, true); value.content = "WWW MMM contenido ficticio muy extenso ".repeat(260); const plan = adapter.createRenderPlan(value); expect(plan.renderedContentLineCount).toBe(plan.contentLines.length); expect(plan.pages.some((page) => page.kind === "CONTENT_CONTINUATION")).toBe(true); expect(plan.pages.flatMap((page) => page.rows)).toHaveLength(4); });
  it("conserva veinte líneas reales de observaciones", () => { const value = data(2); value.observations = Array.from({ length: 20 }, (_, index) => `Línea ${index + 1}: WWW MMM observación ficticia.`).join("\n"); const plan = adapter.createRenderPlan(value); expect(plan.observationLines).toHaveLength(20); expect(plan.renderedObservationLineCount).toBe(20); expect(plan.pages.at(-1)?.showFooter).toBe(true); });
  it("mantiene regiones y texto dentro del área imprimible", () => { const value = data(40, true); value.content = "WWW MMM contenido ".repeat(120); value.observations = Array.from({ length: 20 }, (_, index) => `Observación ${index + 1}`).join("\n"); const plan = adapter.createRenderPlan(value); expect(maximumLineOverflow(plan)).toBeLessThanOrEqual(0.01); for (const page of plan.pages) for (const region of page.regions) { expect(region.left).toBeGreaterThanOrEqual(plan.template.page.margins.left - 0.01); expect(region.right).toBeLessThanOrEqual(plan.template.page.width - plan.template.page.margins.right + 0.01); expect(region.bottom).toBeGreaterThanOrEqual(plan.template.page.margins.bottom - 0.01); } });
});
