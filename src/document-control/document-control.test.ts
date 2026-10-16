import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/auth/current-user";
import type { TrainingSession } from "@/domain/training-session";
import type { Training } from "@/domain/training";
import type { SessionRepository } from "@/server/session-repository";
import type { TrainingRepository } from "@/server/training-repository";
import { calculateDocumentStatus } from "./domain";
import { InMemoryDocumentControlRepository } from "./repository";
import { DocumentControlAuthorizationError, DocumentControlNotApplicableError, DocumentControlService } from "./service";
import { documentControlInputSchema } from "./types";

const actor = (role: CurrentUser["role"]): CurrentUser => ({ id: `actor-${role}`, displayName: "Persona ficticia", role });
const baseSession = (id: string, code: string, status: TrainingSession["executionStatus"], executionDate?: string): TrainingSession => ({
  id, trainingId: id === "executed-2025" ? "training-2" : "training-1", code, plannedDate: executionDate ?? "2026-01-01", executionDate,
  durationMinutes: 60, executionStatus: status, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", attendances: [],
});
const sessions: TrainingSession[] = [
  baseSession("executed-empty", "FOR-2026-0001-S01", "EXECUTED", "2026-02-01"),
  baseSession("executed-partial", "FOR-2026-0001-S02", "EXECUTED", "2026-03-01"),
  baseSession("executed-complete", "FOR-2026-0001-S03", "EXECUTED", "2026-04-01"),
  baseSession("executed-2025", "FOR-2025-0002-S01", "EXECUTED", "2025-05-01"),
  baseSession("pending", "FOR-2026-0001-S04", "PENDING"),
  baseSession("not-executed", "FOR-2026-0001-S05", "NOT_EXECUTED"),
];
const trainings: Training[] = [
  { id: "training-1", code: "FOR-2026-0001", year: 2026, name: "Curso ficticio Alfa", planningType: "PLANNED", isGmp: false, originType: "INTERNAL", createdByUserId: "demo", createdAt: "", updatedAt: "" },
  { id: "training-2", code: "FOR-2025-0002", year: 2025, name: "Curso ficticio Beta", planningType: "PLANNED", isGmp: false, originType: "EXTERNAL", createdByUserId: "demo", createdAt: "", updatedAt: "" },
];
const sessionRepository = {
  listAll: async () => structuredClone(sessions),
  findById: async (id: string) => structuredClone(sessions.find((item) => item.id === id)),
} as unknown as SessionRepository;
const trainingRepository = { list: async () => structuredClone(trainings), findById: async (id: string) => trainings.find((item) => item.id === id) } as unknown as TrainingRepository;
function setup() {
  const repository = new InMemoryDocumentControlRepository([
    { id: "partial", sessionId: "executed-partial", signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: false, dossierPrinted: true, updatedByUserId: "demo", updatedAt: "2026-03-02T00:00:00.000Z" },
    { id: "complete", sessionId: "executed-complete", signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: true, dossierPrinted: true, updatedByUserId: "demo", updatedAt: "2026-04-02T00:00:00.000Z" },
  ]);
  return { repository, service: new DocumentControlService(repository, sessionRepository, trainingRepository) };
}

describe("estado documental derivado", () => {
  it("sin impresión produce PRINT_PENDING", () => expect(calculateDocumentStatus({ signedAnnexIII: false, trainingMaterialArchived: false, evaluationEvidenceArchived: false, dossierPrinted: false })).toBe("PRINT_PENDING"));
  it("impreso con documentación sin marcar y sin motivo produce DOCUMENTATION_PENDING", () => expect(calculateDocumentStatus({ signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: false, dossierPrinted: true })).toBe("DOCUMENTATION_PENDING"));
  it("impreso con todos los controles produce CONFORMING", () => expect(calculateDocumentStatus({ signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: true, dossierPrinted: true })).toBe("CONFORMING"));
  it("acepta control no marcado si está justificado", () => expect(calculateDocumentStatus({ signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: false, evaluationEvidenceReason: "No aplica", dossierPrinted: true })).toBe("CONFORMING"));
  it("rechaza campos adicionales en PATCH", () => expect(documentControlInputSchema.safeParse({ signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: true, dossierPrinted: true, extra: true }).success).toBe(false));
});
describe("servicio de control documental", () => {
  it("interpreta la ausencia de registro ejecutado como impresion pendiente", async () => expect(await setup().service.get("executed-empty", actor("ADMIN"))).toMatchObject({ documentStatus: "PRINT_PENDING", signedAnnexIII: false, trainingMaterialArchived: false, evaluationEvidenceArchived: false }));
  it.each(["RESPONSIBLE", "ADMIN"] as const)("permite actualizar a %s", async (role) => expect((await setup().service.update("executed-empty", { signedAnnexIII: true, trainingMaterialArchived: false, evaluationEvidenceArchived: false }, actor(role)))?.updatedByUserId).toBe(`actor-${role}`));
  it("impide actualizar a USER", async () => await expect(setup().service.update("executed-empty", { signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: true, dossierPrinted: true }, actor("USER"))).rejects.toBeInstanceOf(DocumentControlAuthorizationError));
  it("impide a USER consultar la cola", async () => await expect(setup().service.list(actor("USER"))).rejects.toBeInstanceOf(DocumentControlAuthorizationError));
  it.each(["pending", "not-executed"])("impide actualizar una sesión no aplicable: %s", async (id) => await expect(setup().service.update(id, { signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: true, dossierPrinted: true }, actor("ADMIN"))).rejects.toBeInstanceOf(DocumentControlNotApplicableError));
  it("solo lista sesiones ejecutadas", async () => expect((await setup().service.list(actor("ADMIN"), { status: "ALL" })).map((item) => item.sessionId)).not.toEqual(expect.arrayContaining(["pending", "not-executed"])));
  it("incluye ejecutadas sin registro como PRINT_PENDING", async () => expect(await setup().service.list(actor("ADMIN"), { status: "PRINT_PENDING" })).toEqual(expect.arrayContaining([expect.objectContaining({ sessionId: "executed-empty", documentStatus: "PRINT_PENDING" })])));
  it("filtra PRINT_PENDING", async () => expect((await setup().service.list(actor("ADMIN"), { status: "PRINT_PENDING" })).every((item) => item.documentStatus === "PRINT_PENDING")).toBe(true));
  it("filtra CONFORMING", async () => expect((await setup().service.list(actor("ADMIN"), { status: "CONFORMING" })).map((item) => item.sessionId)).toEqual(["executed-complete"]));
  it("ALL incluye los tres estados documentales", async () => expect(new Set((await setup().service.list(actor("ADMIN"), { status: "ALL" })).map((item) => item.documentStatus))).toEqual(new Set(["PRINT_PENDING", "DOCUMENTATION_PENDING", "CONFORMING"])));
  it("filtra por el año de executionDate", async () => expect((await setup().service.list(actor("ADMIN"), { status: "ALL", year: 2025 })).map((item) => item.sessionId)).toEqual(["executed-2025"]));
  it("filtra por formación sin mezclar sesiones de otros expedientes", async () => expect((await setup().service.list(actor("ADMIN"), { status: "ALL", trainingId: "training-2" })).map((item) => item.trainingId)).toEqual(["training-2"]));
  it.each(["alfa", "FOR-2026-0001", "S03"])("busca por formación o códigos: %s", async (search) => expect((await setup().service.list(actor("ADMIN"), { status: "ALL", search })).length).toBeGreaterThan(0));
  it("desmarcar un check sin justificar devuelve DOCUMENTATION_PENDING si esta impreso", async () => expect((await setup().service.update("executed-complete", { signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: false, dossierPrinted: true }, actor("ADMIN")))?.documentStatus).toBe("DOCUMENTATION_PENDING"));
  it("actualizar el control no modifica executionStatus", async () => { await setup().service.update("executed-empty", { signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: true }, actor("ADMIN")); expect((await sessionRepository.findById("executed-empty"))?.executionStatus).toBe("EXECUTED"); });
  it("mantiene una única fila por sesión mediante upsert", async () => { const { repository } = setup(); await repository.upsert("executed-empty", { signedAnnexIII: false, trainingMaterialArchived: false, evaluationEvidenceArchived: false }, "one"); await repository.upsert("executed-empty", { signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: true }, "two"); expect(await repository.findBySessionIds(["executed-empty"])).toHaveLength(1); });

  it("adjunta varias evidencias por categoría sin marcar automáticamente los checks", async () => {
    const { repository, service } = setup();
    await service.addAttachment("executed-empty", {
      category: "SIGNED_ANNEX_III",
      fileName: "anexo-firmado-demo.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("demo-anexo"),
    }, actor("ADMIN"));
    await service.addAttachment("executed-empty", {
      category: "TRAINING_MATERIAL",
      fileName: "material-demo.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("demo-material"),
    }, actor("RESPONSIBLE"));
    const state = await service.get("executed-empty", actor("ADMIN"));
    expect(state).toMatchObject({
      signedAnnexIII: false,
      trainingMaterialArchived: false,
      evaluationEvidenceArchived: false,
      documentStatus: "PRINT_PENDING",
    });
    expect(state?.attachments.map((item) => item.category)).toEqual(expect.arrayContaining(["SIGNED_ANNEX_III", "TRAINING_MATERIAL"]));
    expect(await repository.findAttachmentsBySessionId("executed-empty")).toHaveLength(2);
  });

  it("comparte las evidencias entre ficha de sesión y cola documental", async () => {
    const { service } = setup();
    await service.addAttachment("executed-partial", {
      category: "EVALUATION_EVIDENCE",
      fileName: "evaluacion-demo.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("demo-evaluacion"),
    }, actor("ADMIN"));
    const detail = await service.get("executed-partial", actor("ADMIN"));
    const row = (await service.list(actor("ADMIN"), { status: "ALL" })).find((item) => item.sessionId === "executed-partial");
    expect(detail?.attachments.map((item) => item.fileName)).toContain("evaluacion-demo.pdf");
    expect(row?.attachments.map((item) => item.fileName)).toContain("evaluacion-demo.pdf");
  });

  it("permite retirar una evidencia sin alterar las confirmaciones", async () => {
    const { service } = setup();
    const created = await service.addAttachment("executed-complete", {
      category: "SIGNED_ANNEX_III",
      fileName: "anexo-demo.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("demo"),
    }, actor("ADMIN"));
    expect(created).toBeTruthy();
    await service.removeAttachment("executed-complete", created!.id, actor("ADMIN"));
    const state = await service.get("executed-complete", actor("ADMIN"));
    expect(state?.attachments).toHaveLength(0);
    expect(state?.documentStatus).toBe("CONFORMING");
  });

  it("impide adjuntar evidencias en sesiones no ejecutadas o por USER", async () => {
    const { service } = setup();
    const input = { category: "TRAINING_MATERIAL" as const, fileName: "demo.pdf", mimeType: "application/pdf", content: Buffer.from("demo") };
    await expect(service.addAttachment("pending", input, actor("ADMIN"))).rejects.toBeInstanceOf(DocumentControlNotApplicableError);
    await expect(service.addAttachment("executed-empty", input, actor("USER"))).rejects.toBeInstanceOf(DocumentControlAuthorizationError);
  });

  it("Prisma modela las evidencias documentales por categoría y con contenido binario", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const source = readFileSync("src/document-control/prisma-repository.ts", "utf8");
    expect(schema).toContain("model DocumentControlAttachment");
    expect(schema).toContain("DocumentControlAttachmentCategory");
    expect(schema).toContain("content           Bytes");
    expect(source).toContain("DOCUMENT_CONTROL_ATTACHMENT_ADDED");
    expect(source).toContain("DOCUMENT_CONTROL_ATTACHMENT_REMOVED");
  });
});
