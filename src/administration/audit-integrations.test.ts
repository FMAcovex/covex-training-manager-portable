import { describe, expect, it } from "vitest";
import { InMemoryAuditEventRepository } from "./audit-repository";
import { InMemoryTrainingRepository } from "@/server/training-repository";
import { InMemoryPeopleRepository } from "@/server/people-repository";
import { InMemorySessionRepository, demoSessions } from "@/server/session-repository";
import { InMemoryDocumentControlRepository } from "@/document-control/repository";
import { DocumentControlService } from "@/document-control/service";
import type { CurrentUser } from "@/auth/current-user";

const admin: CurrentUser = { id: "demo-user", displayName: "Admin", role: "ADMIN" };
describe("integraciones de auditoría", () => {
  it("registra alta, edición, baja y reactivación de Personal", async () => {
    const audit = new InMemoryAuditEventRepository();
    const people = new InMemoryPeopleRepository([], undefined, false, audit);
    const created = await people.create({ fullName: "Persona auditada", personType: "EXTERNAL", company: "Entidad", jobTitle: "Docente" }, "admin");
    await people.update(created.id, { fullName: "Persona auditada actualizada", personType: "EXTERNAL", company: "Entidad", jobTitle: "Docente" }, "admin");
    await people.deactivate(created.id, "admin");
    await people.activate(created.id, "admin");
    expect((await audit.list({ entityType: "PERSON" })).map((event) => event.action)).toEqual(expect.arrayContaining([
      "PERSON_CREATED",
      "PERSON_UPDATED",
      "PERSON_DEACTIVATED",
      "PERSON_ACTIVATED",
    ]));
    expect(await audit.list({ entityType: "PERSON" })).toHaveLength(4);
  });

  it("registra creación, ejecución y no ejecución de Sesiones", async () => {
    const audit = new InMemoryAuditEventRepository();
    const trainings = new InMemoryTrainingRepository();
    const sessions = new InMemorySessionRepository(trainings, new InMemoryPeopleRepository(), undefined, audit);
    const input = { trainingId: "training-demo-1", plannedDate: "2026-11-01", trainerPersonId: "demo-1", durationMinutes: 60, attendeePersonIds: ["demo-1"] };
    const executed = await sessions.create(input, admin);
    await sessions.finalize(executed.id, { executionDate: "2026-11-01", initializeDefaults: true, attendances: [] }, admin);
    const notExecuted = await sessions.create({ ...input, plannedDate: "2026-11-02" }, admin);
    await sessions.markNotExecuted(notExecuted.id, { reason: "Motivo auditado" }, admin);
    expect(await audit.list({ action: "TRAINING_SESSION_CREATED" })).toHaveLength(2);
    expect((await audit.list({ action: "TRAINING_SESSION_EXECUTED" }))[0]).toMatchObject({ actorUserId: admin.id, entityId: executed.id });
    expect((await audit.list({ action: "TRAINING_SESSION_NOT_EXECUTED" }))[0]).toMatchObject({ actorUserId: admin.id, entityId: notExecuted.id });
  });
  it("crear y editar una Formación registra actor y estados anterior/posterior", async () => {
    const audit = new InMemoryAuditEventRepository();
    const trainings = new InMemoryTrainingRepository([], undefined, audit);
    const input = { year: 2027, name: "Curso de auditoría", planningType: "PLANNED" as const, isGmp: false, originType: "INTERNAL" as const };
    const created = await trainings.create(input, "creator-user");
    await trainings.update(created.id, { ...input, name: "Curso actualizado" }, "editor-user");

    const createdEvent = (await audit.list({ action: "TRAINING_CREATED" }))[0];
    expect(createdEvent).toMatchObject({ actorUserId: "creator-user", entityType: "TRAINING", entityId: created.id, contextJson: { code: created.code } });
    expect(createdEvent.afterJson).toMatchObject({ name: "Curso de auditoría", createdByUserId: "creator-user" });

    const updatedEvent = (await audit.list({ action: "TRAINING_UPDATED" }))[0];
    expect(updatedEvent).toMatchObject({ actorUserId: "editor-user", entityType: "TRAINING", entityId: created.id });
    expect(updatedEvent.beforeJson).toMatchObject({ name: "Curso de auditoría" });
    expect(updatedEvent.afterJson).toMatchObject({ name: "Curso actualizado" });
  });

  it("una edición de Formación rechazada no genera auditoría", async () => {
    const audit = new InMemoryAuditEventRepository();
    const trainings = new InMemoryTrainingRepository([], undefined, audit);
    const input = { year: 2027, name: "Curso estable", planningType: "PLANNED" as const, isGmp: false, originType: "INTERNAL" as const };
    const created = await trainings.create(input, "creator-user");
    await expect(trainings.update(created.id, { ...input, year: 2028 }, "editor-user")).rejects.toThrow("año");
    expect(await audit.list({ action: "TRAINING_UPDATED" })).toHaveLength(0);
  });

  it.each(["EXECUTED", "NOT_EXECUTED"] as const)("corregir %s genera CLOSED_SESSION_CORRECTED con before/after", async (status) => {
    const audit = new InMemoryAuditEventRepository(); const sessions = new InMemorySessionRepository(new InMemoryTrainingRepository(), new InMemoryPeopleRepository(), demoSessions, audit); const id = status === "EXECUTED" ? "session-demo-1" : "session-demo-3"; const before = await sessions.findById(id); await sessions.update(id, { trainingId: before!.trainingId, plannedDate: before!.plannedDate, trainerPersonId: before!.trainerPersonId, externalTrainerName: before!.externalTrainerName, durationMinutes: before!.durationMinutes + 5, notes: "Corrección", attendeePersonIds: before!.attendances.map((a) => a.personId) }, admin); const event = (await audit.list({ action: "CLOSED_SESSION_CORRECTED" }))[0]; expect(event.beforeJson).toMatchObject({ executionStatus: status, durationMinutes: before!.durationMinutes }); expect(event.afterJson).toMatchObject({ executionStatus: status, durationMinutes: before!.durationMinutes + 5 });
  });
  it("editar PENDING no genera CLOSED_SESSION_CORRECTED", async () => { const audit = new InMemoryAuditEventRepository(); const sessions = new InMemorySessionRepository(new InMemoryTrainingRepository(), new InMemoryPeopleRepository(), demoSessions, audit); const before = await sessions.findById("session-demo-2"); await sessions.update("session-demo-2", { trainingId: before!.trainingId, plannedDate: before!.plannedDate, trainerPersonId: before!.trainerPersonId, durationMinutes: before!.durationMinutes, notes: "Ordinaria", attendeePersonIds: before!.attendances.map((a) => a.personId) }, admin); expect(await audit.list({ action: "CLOSED_SESSION_CORRECTED" })).toHaveLength(0); });
  it("DocumentControl cambiado genera evento y PATCH idéntico no lo duplica", async () => { const audit = new InMemoryAuditEventRepository(); const controls = new InMemoryDocumentControlRepository([], audit); const sessions = new InMemorySessionRepository(new InMemoryTrainingRepository(), new InMemoryPeopleRepository()); const service = new DocumentControlService(controls, sessions, new InMemoryTrainingRepository()); const input = { signedAnnexIII: true, trainingMaterialArchived: false, evaluationEvidenceArchived: false }; await service.update("session-demo-1", input, admin); await service.update("session-demo-1", input, admin); const events = await audit.list({ action: "DOCUMENT_CONTROL_UPDATED" }); expect(events).toHaveLength(1); expect(events[0].beforeJson).toMatchObject({ documentStatus: "PRINT_PENDING" }); expect(events[0].afterJson).toMatchObject({ signedAnnexIII: true, documentStatus: "PRINT_PENDING" }); });
});
