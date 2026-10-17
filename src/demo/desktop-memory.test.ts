import * as fs from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { readDemoJson, writeDemoJson } from "./demo-data-store";
import { InMemoryAuditEventRepository } from "@/administration/audit-repository";
import { InMemoryPeopleRepository } from "@/server/people-repository";
import { InMemoryTrainingRepository } from "@/server/training-repository";
import { InMemorySessionRepository } from "@/server/session-repository";
import { validateTraining } from "@/domain/training";
import { validatePerson } from "@/domain/person";
import { validateFinalizeSession, validateSessionInput } from "@/domain/training-session";
import type { CurrentUser } from "@/auth/current-user";

vi.mock("node:fs", async (original) => ({ ...await original<typeof fs>(),
  existsSync: vi.fn(), readFileSync: vi.fn(), mkdirSync: vi.fn(), writeFileSync: vi.fn(), renameSync: vi.fn(),
}));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it("keeps edits, attendance, numbering and audit in RAM, never touching any filesystem sink, and resets to the synthetic seed", async () => {
  vi.stubEnv("PORTABLE_DESKTOP_MODE", "demo");
  vi.stubEnv("DEMO_DATA_DIR", "/must-not-read-or-write/OneDrive/corporate");
  const io = ["existsSync", "readFileSync", "mkdirSync", "writeFileSync", "renameSync"] as const;
  const spies = io.map((name) => vi.mocked(fs[name]));
  expect(readDemoJson("people-current.json")).toBeUndefined();
  expect(() => writeDemoJson("../not-an-export.json", { synthetic: true })).not.toThrow();
  const actor: CurrentUser = { id: "demo-admin", displayName: "Demo", role: "ADMIN" };
  function fresh() {
    const audit = new InMemoryAuditEventRepository(undefined, true);
    const people = new InMemoryPeopleRepository(undefined, undefined, true, audit);
    const trainings = new InMemoryTrainingRepository(undefined, undefined, audit, true);
    const sessions = new InMemorySessionRepository(trainings, people, undefined, audit, true);
    return { audit, people, trainings, sessions };
  }
  const repositories = fresh();
  const initialPeople = await repositories.people.list();
  const initialTrainings = await repositories.trainings.list();
  const initialSessions = await repositories.sessions.listAll();
  const person = await repositories.people.create(validatePerson({ fullName: "Asistente ficticio H10D", personType: "INTERNAL", employeeCode: "SYN-H10D", departmentId: "quality", jobTitle: "Prueba sintética" }), actor.id);
  const input = validateTraining({ year: 2027, name: "Formación ficticia H10D", planningType: "PLANNED", originType: "EXTERNAL", isGmp: false, externalTrainerNames: ["Entidad ficticia"] });
  const training = await repositories.trainings.create(input, actor.id);
  await repositories.trainings.update(training.id, { ...input, name: "Formación ficticia editada" }, actor.id);
  const sessionInput = validateSessionInput({ trainingId: training.id, plannedDate: "2027-01-12", externalTrainerNames: ["Entidad ficticia"], durationMinutes: 60, attendeePersonIds: [person.id, "demo-1"] });
  const session = await repositories.sessions.create(sessionInput, actor);
  await repositories.sessions.update(session.id, { ...sessionInput, durationMinutes: 90 }, actor);
  await repositories.sessions.finalize(session.id, validateFinalizeSession({ executionDate: "2027-01-12", initializeDefaults: false, attendances: [{ personId: person.id, attendanceStatus: "ATTENDED", result: "FAIL" }, { personId: "demo-1", attendanceStatus: "NOT_ATTENDED", result: "NOT_APPLICABLE" }] }), actor);
  expect((await repositories.sessions.findById(session.id))?.attendances.map((item) => item.result)).toEqual(["FAIL", "NOT_APPLICABLE"]);
  await expect(repositories.sessions.update(session.id, { ...sessionInput, attendeePersonIds: [person.id] }, actor)).rejects.toThrow("cerrada");
  await repositories.sessions.reopen(session.id, "Corrección ficticia", actor);
  await repositories.sessions.update(session.id, { ...sessionInput, attendeePersonIds: [person.id] }, actor);
  await repositories.sessions.finalize(session.id, validateFinalizeSession({ executionDate: "2027-01-12", initializeDefaults: true }), actor);
  expect(await repositories.trainings.findById(training.id)).toMatchObject({ name: "Formación ficticia editada" });
  const events = await repositories.audit.list();
  expect(events.map((event) => event.action)).toContain("TRAINING_SESSION_REOPENED");
  expect(JSON.stringify(events)).toContain('"result":"FAIL"');
  const restarted = fresh();
  expect(await restarted.people.list()).toEqual(initialPeople);
  expect(await restarted.trainings.list()).toEqual(initialTrainings);
  expect(await restarted.sessions.listAll()).toEqual(initialSessions);
  expect(await restarted.audit.list()).toEqual([]);
  expect((await restarted.trainings.create(input, actor.id)).code).toBe(training.code);
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});
