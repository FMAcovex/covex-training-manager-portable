import { describe, expect, it } from "vitest";
import { GraphConflictError } from "@/portable/graph/graph-client";
import { InMemoryPortableEntityStore } from "./entity-store";
import { createPortableProvider } from "./provider";
import { PORTABLE_PRISMA_MODELS, assertCompletePortableSchema } from "./schema";
import { PortablePartialWriteError, PortableUnitOfWork } from "./unit-of-work";
import { readFileSync } from "node:fs";

const actor = { id: "user-admin", displayName: "Admin sintético", role: "ADMIN" as const };

async function seed(store: InMemoryPortableEntityStore) {
  await store.create("Department", "quality", { id: "quality", code: "GC", name: "Calidad", active: true }, { uniqueKey: "GC" });
  await store.create("TrainingType", "type", { id: "type", code: "GMP", name: "GMP", active: true }, { uniqueKey: "GMP" });
  await store.create("Modality", "onsite", { id: "onsite", code: "PRE", name: "Presencial", active: true }, { uniqueKey: "PRE" });
  await store.create("EvaluationMethod", "test", { id: "test", code: "TEST", name: "Test", active: true }, { uniqueKey: "TEST" });
}

describe("H10B SharePoint core", () => {
  it("maps exactly all 22 Prisma models", () => {
    expect(assertCompletePortableSchema()).toBe(true);
    expect(PORTABLE_PRISMA_MODELS).toHaveLength(22);
    expect(new Set(PORTABLE_PRISMA_MODELS).size).toBe(22);
    const prismaModels = [...readFileSync("prisma/schema.prisma", "utf8").matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
    expect([...PORTABLE_PRISMA_MODELS].sort()).toEqual(prismaModels.sort());
  });

  it("rejects stale ETags from a second user", async () => {
    const store = new InMemoryPortableEntityStore();
    const initial = await store.create("Person", "p1", { name: "Inicial" });
    await store.update("Person", initial, { name: "Usuario A" });
    await expect(store.update("Person", initial, { name: "Usuario B" })).rejects.toBeInstanceOf(GraphConflictError);
  });

  it("marks a non-compensable partial write for reconciliation", async () => {
    const store = new InMemoryPortableEntityStore();
    const work = new PortableUnitOfWork(store);
    await expect(work.execute("TEST_PARTIAL", [
      { name: "external-document", execute: async () => undefined },
      { name: "metadata", execute: async () => { throw new Error("connection"); } },
    ], { correlationId: "correlation-1" })).rejects.toBeInstanceOf(PortablePartialWriteError);
    await expect(store.get<{ state: string }>("CovexOperation", "correlation-1")).resolves.toMatchObject({ data: { state: "NEEDS_RECONCILIATION" } });
  });

  it("creates concurrent training numbers and preserves the domain flow", async () => {
    const store = new InMemoryPortableEntityStore(); await seed(store);
    const provider = createPortableProvider(store);
    const person = await provider.people.create({ fullName: "Persona sintética", employeeCode: "SYN-1", personType: "INTERNAL", departmentId: "quality", jobTitle: "Técnico" }, actor.id);
    const input = {
      year: 2026, name: "Curso sintético", planningType: "PLANNED" as const, trainingTypeId: "type", isGmp: true,
      originType: "INTERNAL" as const, modalityId: "onsite", plannedDurationMinutes: 60, materialReference: "SYN-DOC",
      content: "Contenido sintético", targetGroup: "Grupo sintético", targetDepartmentIds: ["quality"], plannedTrainerPersonIds: [person.id],
      evaluationMethodId: "test", aptitudeCriterion: "Apto", frequencyMonths: 12,
    };
    const attempts = await Promise.allSettled([
      provider.trainings.create(input, actor.id),
      provider.trainings.create({ ...input, name: "Curso sintético 2" }, actor.id),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.find((result) => result.status === "rejected")).toMatchObject({ reason: expect.any(GraphConflictError) });
    const accepted = attempts.find((result) => result.status === "fulfilled");
    if (!accepted || accepted.status !== "fulfilled") throw new Error("Falta la operación aceptada");
    const first = accepted.value;
    const second = await provider.trainings.create({ ...input, name: "Reintento explícito del segundo usuario" }, actor.id);
    expect(new Set([first.code, second.code])).toEqual(new Set(["FOR-2026-0001", "FOR-2026-0002"]));
    const session = await provider.sessions.create({ trainingId: first.id, plannedDate: "2026-12-01", trainerPersonIds: [person.id], durationMinutes: 60, attendeePersonIds: [person.id] }, actor);
    const finalized = await provider.sessions.finalize(session.id, { executionDate: "2026-12-01", initializeDefaults: true, attendances: [] }, actor);
    expect(finalized).toMatchObject({ code: `${first.code}-S01`, executionStatus: "EXECUTED" });
    expect(await store.list("TrainingPlannedTrainer")).toHaveLength(2);
    expect(await store.list("TrainingTargetDepartment")).toHaveLength(2);
    expect(await store.list("TrainingSessionTrainer")).toHaveLength(1);
    expect(await store.list("Attendance")).toHaveLength(1);
  });
});
