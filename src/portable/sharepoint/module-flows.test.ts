import { describe, expect, it } from "vitest";
import { InMemoryPortableEntityStore } from "./entity-store";
import { createPortableProvider } from "./provider";
import { SUPPORTED_DEVELOPMENT_FIXTURES } from "@/annexes/supported-fixtures";

const actor = { id: "synthetic-actor", displayName: "Admin sintético", role: "ADMIN" as const };

describe("H10B repository module flows", () => {
  it("preserves user, catalog, qualified trainer, annex metadata and document-control rules", async () => {
    const raw = new InMemoryPortableEntityStore(); const provider = createPortableProvider(raw);
    const user = await provider.users.create({ entraObjectId: "11111111-1111-4111-8111-111111111111", email: "synthetic@example.invalid", displayName: "Admin sintético", role: "ADMIN", active: true }, actor);
    expect(await provider.users.findByEntraObjectId(user.entraObjectId)).toMatchObject({ id: user.id, role: "ADMIN" });
    await expect(provider.users.update(user.id, { active: false }, actor)).rejects.toThrow("ADMIN activo");
    const department = await provider.catalogs.create("departments", { code: "SYN", name: "Departamento sintético", active: true }, actor);
    const trainer = await provider.trainers.createQualifiedTrainer({ fullName: "Formador sintético", employeeCode: "SYN-TRAINER", personType: "INTERNAL", departmentId: department.id, jobTitle: "Técnico" }, { authorizedSubject: "Materia sintética", evidence: "Evidencia sintética", qualifiedFrom: "2026-01-01" }, actor.id);
    expect((await provider.trainers.list({ currentOnly: true })).map((item) => item.id)).toContain(trainer.id);
    await expect(provider.catalogs.update("departments", department.id, { name: "Otro nombre" }, actor)).rejects.toThrow("referenciado");
    await provider.trainers.retireQualification(trainer.id, "2027-01-01", actor.id);
    await provider.trainers.annulQualification(trainer.id, "Anulación sintética", actor.id);
    expect(await provider.trainers.list()).toHaveLength(0);
    expect(await provider.trainers.list({ includeAnnulled: true })).toMatchObject([{ id: trainer.id, current: false, annulmentReason: "Anulación sintética" }]);
    const template = await provider.annexes.registerTemplateVersion({ ...SUPPORTED_DEVELOPMENT_FIXTURES.ANNEX_III, effectiveFrom: "2026-01-01T00:00:00.000Z", active: true }, actor);
    await expect(provider.annexes.registerTemplateVersion({ ...SUPPORTED_DEVELOPMENT_FIXTURES.ANNEX_III, effectiveFrom: "2026-01-01T00:00:00.000Z", active: true }, actor)).rejects.toThrow("ya existe");
    const generated = await provider.annexes.createGeneratedDocument({ annexType: "ANNEX_III", templateVersionId: template.id, sessionId: "synthetic-session", generatedByUserId: actor.id });
    expect(await provider.annexes.listGeneratedDocuments("synthetic-session")).toMatchObject([{ id: generated.id }]);
    const control = await provider.documentControl.upsert("synthetic-session", { signedAnnexIII: false, trainingMaterialArchived: true, evaluationEvidenceArchived: false, dossierPrinted: true, signedAnnexIIIReason: "Pendiente sintético", evaluationEvidenceReason: "Pendiente sintético" }, actor);
    expect(await provider.documentControl.findBySessionId("synthetic-session")).toMatchObject({ id: control.id, signedAnnexIII: false, trainingMaterialArchived: true, dossierPrinted: true });
    expect(await raw.list("AuditEvent")).not.toHaveLength(0);
    expect(await raw.get("CovexOperation", "portable-global-write-lock")).toMatchObject({ data: { state: "FREE" } });
  });
});
