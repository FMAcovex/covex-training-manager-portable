import { describe, expect, it } from "vitest";
import { createPortableProvider } from "./provider";
import { InMemoryPortableEntityStore } from "./entity-store";
import { PORTABLE_WRITE_LOCK_ID } from "./write-coordinator";
import { SessionConflictError } from "@/server/session-repository";
import { InMemoryPeopleRepository, PeopleDuplicateCodeError } from "@/server/people-repository";
import { validateTraining } from "@/domain/training";
import { validateSessionInput } from "@/domain/training-session";
import { TrainingClosureService } from "@/training-closure/service";

const actor = { id: "synthetic-auditor", displayName: "Ficticio", role: "ADMIN" as const };
const personInput = { fullName: "Persona ficticia", employeeCode: "SYN-001", personType: "EXTERNAL" as const, company: "Empresa ficticia", jobTitle: "Puesto ficticio" };
async function scenario() {
  const raw = new InMemoryPortableEntityStore();
  const provider = createPortableProvider(raw);
  const person = await provider.people.create(personInput, actor.id);
  const training = await provider.trainings.create(validateTraining({ year: 2026, name: "Curso ficticio", planningType: "PLANNED", originType: "EXTERNAL", isGmp: false }), actor.id);
  const input = validateSessionInput({ trainingId: training.id, plannedDate: "2026-10-01", externalTrainerNames: ["Entidad ficticia"], durationMinutes: 60, attendeePersonIds: [person.id] });
  const session = await provider.sessions.create(input, actor);
  return { raw, provider, training, input, session, person };
}
const finalize = { executionDate: "2026-10-01", initializeDefaults: true, attendances: [] };

describe("correcciones de auditoría A01–A07/A12", () => {
  it("rejects a stale edit from an independent client without changing data or blocking subsequent writes", async () => {
    const { raw, provider, session, input } = await scenario();
    const secondClient = createPortableProvider(raw);
    const snapshot = await secondClient.sessions.findById(session.id);
    const updated = await provider.sessions.update(session.id, { ...input, durationMinutes: 90 }, actor, session.updatedAt);
    expect(updated!.updatedAt).not.toBe(session.updatedAt);
    await expect(secondClient.sessions.update(session.id, input, actor, snapshot!.updatedAt)).rejects.toBeInstanceOf(SessionConflictError);
    expect(await provider.sessions.findById(session.id)).toMatchObject({ durationMinutes: 90 });
    expect(await raw.get("CovexOperation", PORTABLE_WRITE_LOCK_ID)).toMatchObject({ data: { state: "FREE" } });
  });
  it("retains the mandatory reason, previous results and correction event classification", async () => {
    const { provider, session, input } = await scenario();
    await provider.sessions.finalize(session.id, finalize, actor);
    await provider.sessions.update(session.id, { ...input, durationMinutes: 90 }, actor);
    const reason = "Corrección ficticia motivada";
    await provider.sessions.reopen(session.id, reason, actor);
    const events = await provider.audit.list({ entityType: "TRAINING_SESSION" });
    expect(events.find((item) => item.action === "CLOSED_SESSION_CORRECTED")).toMatchObject({ contextJson: { previousStatus: "EXECUTED" } });
    expect(events.find((item) => item.action === "TRAINING_SESSION_REOPENED")).toMatchObject({ contextJson: { reason }, beforeJson: { attendances: [expect.objectContaining({ result: "PASS" })] }, afterJson: { executionStatus: "PENDING" } });
  });
  it("requires explicit documentary reopening before creation/import, with no reserved sequence on rejection", async () => {
    const { provider, session, training, input, raw } = await scenario();
    await provider.sessions.finalize(session.id, finalize, actor);
    await provider.documentControl.upsert(session.id, { dossierPrinted: true, signedAnnexIII: true, trainingMaterialArchived: true, evaluationEvidenceArchived: true }, actor);
    const closure = new TrainingClosureService(provider.trainings, provider.sessions, provider.documentControl);
    await closure.close(training.id, actor);
    const sequence = await raw.findUnique("SessionCodeSequence", training.id);
    await expect(provider.sessions.create(input, actor)).rejects.toThrow("Reabre explícitamente");
    await expect(provider.sessions.importHistorical({ ...input, executionStatus: "PENDING", attendances: [] }, actor)).rejects.toThrow("Reabre explícitamente");
    expect(await raw.findUnique("SessionCodeSequence", training.id)).toEqual(sequence);
    await provider.trainings.reopenDocumentary(training.id, "Nueva sesión ficticia", actor.id);
    expect(await provider.sessions.create(input, actor)).toMatchObject({ code: `${training.code}-S02` });
  });
  it("rejects duplicates on create/update, including inactive people, without reconciliation", async () => {
    const { provider, raw, person } = await scenario();
    await provider.people.deactivate(person.id, actor.id);
    await expect(provider.people.create(personInput, actor.id)).rejects.toBeInstanceOf(PeopleDuplicateCodeError);
    const other = await provider.people.create({ ...personInput, employeeCode: "SYN-002" }, actor.id);
    await expect(provider.people.update(other.id, personInput, actor.id)).rejects.toBeInstanceOf(PeopleDuplicateCodeError);
    expect(await raw.get("CovexOperation", PORTABLE_WRITE_LOCK_ID)).toMatchObject({ data: { state: "FREE" } });
    expect(await provider.people.update(other.id, { ...personInput, employeeCode: "SYN-002" }, actor.id)).toBeDefined();
  });
  it("aligns demo employee-code uniqueness while allowing missing codes", async () => {
    const people = new InMemoryPeopleRepository([]);
    const person = await people.create(personInput);
    await expect(people.create(personInput)).rejects.toBeInstanceOf(PeopleDuplicateCodeError);
    await people.update(person.id, personInput);
    await people.create({ ...personInput, employeeCode: undefined });
    await people.create({ ...personInput, employeeCode: undefined });
    expect(await people.list()).toHaveLength(3);
  });
  it("stores 250 attendees and complete audit snapshots below each SharePoint field limit", async () => {
    const { raw, provider, training, input } = await scenario();
    const ids: string[] = [];
    // Seed synthetic master rows directly, avoiding irrelevant journal traffic in this volume test.
    for (let n = 0; n < 250; n++) {
      const id = crypto.randomUUID(); ids.push(id);
      await raw.create("Person", id, { ...personInput, id, employeeCode: `VOL-${n}`, active: true });
    }
    const session = await provider.sessions.create({ ...input, attendeePersonIds: ids }, actor);
    expect(JSON.stringify(session).length).toBeGreaterThan(55000);
    expect(await provider.sessions.findById(session.id)).toEqual(session);
    await provider.sessions.finalize(session.id, finalize, actor);
    await provider.sessions.reopen(session.id, "Revisión de volumen ficticia", actor);
    const restarted = createPortableProvider(raw);
    const event = (await restarted.audit.list({ action: "TRAINING_SESSION_REOPENED" }))[0];
    expect(event).toMatchObject({ beforeJson: { attendances: expect.arrayContaining([expect.objectContaining({ result: "PASS" })]) }, contextJson: { reason: "Revisión de volumen ficticia" } });
    expect((event.beforeJson as { attendances: unknown[] }).attendances).toHaveLength(250);
    expect((await restarted.sessions.listByTraining(training.id)).find((item) => item.id === session.id)?.attendances).toHaveLength(250);
    for (const model of ["TrainingSession", "Attendance", "AuditEvent"] as const) for (const row of await raw.list(model)) expect(JSON.stringify(row.data).length).toBeLessThanOrEqual(55000);
  });
  it("fails closed on missing attendance instead of returning a truncated session", async () => {
    const { raw, provider, session } = await scenario();
    const attendance = (await raw.list("Attendance", { parentId: session.id }))[0];
    await raw.delete("Attendance", attendance);
    await expect(provider.sessions.findById(session.id)).rejects.toThrow("asistencias incompletas");
  });
  it("detects corrupted or missing audit chunks", async () => {
    const { raw, provider } = await scenario();
    const event = await provider.audit.append({ actorUserId: actor.id, entityId: "synthetic-large", entityType: "TEST", action: "TEST", afterJson: "X".repeat(60000) });
    const chunk = (await raw.list("AuditEvent", { parentId: event.id }))[0];
    await raw.delete("AuditEvent", chunk);
    await expect(provider.audit.list()).rejects.toThrow("segmentos de auditoría");
  });
  it("reads legacy embedded attendance without rewriting it", async () => {
    const { provider, raw, session } = await scenario();
    const row = (await raw.get("TrainingSession", session.id))!;
    const legacy = await raw.update("TrainingSession", row, session, { parentId: session.trainingId });
    expect(await provider.sessions.findById(session.id)).toEqual(session);
    expect(await raw.get("TrainingSession", session.id)).toEqual(legacy);
  });
  it("does not write or audit unchanged document controls", async () => {
    const { raw, provider, session } = await scenario();
    const input = { dossierPrinted: false, signedAnnexIII: false, trainingMaterialArchived: false, evaluationEvidenceArchived: false };
    await provider.documentControl.upsert(session.id, input, actor);
    const before = await raw.findUnique("DocumentControl", session.id);
    await provider.documentControl.upsert(session.id, { evaluationEvidenceArchived: false, trainingMaterialArchived: false, signedAnnexIII: false, dossierPrinted: false }, actor);
    expect(await raw.findUnique("DocumentControl", session.id)).toEqual(before);
    expect(await provider.audit.list({ action: "DOCUMENT_CONTROL_UPDATED" })).toHaveLength(1);
  });
});
