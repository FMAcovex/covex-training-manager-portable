import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/auth/current-user";
import type { Training } from "@/domain/training";
import type { Attendance, TrainingSession } from "@/domain/training-session";
import type { Person } from "@/domain/person";
import { InMemoryPeopleRepository } from "@/server/people-repository";
import { InMemorySessionRepository } from "@/server/session-repository";
import { InMemoryTrainingRepository } from "@/server/training-repository";
import { addCalendarMonths, PersonHistoryService } from "@/history/person-history-service";
import type { DemoCatalogStore } from "@/administration/demo-catalog-store";

const admin = { id: "admin", displayName: "Admin", role: "ADMIN" } as CurrentUser;
const user = { id: "user", displayName: "User", role: "USER" } as CurrentUser;
const person: Person = { id: "p1", fullName: "Persona Ficticia", employeeCode: "F-1", personType: "INTERNAL", departmentId: "quality", jobTitle: "Técnico/a", active: true };
const base = "2026-01-01T00:00:00Z";
const training = (id: string, partial: Partial<Training> = {}): Training => ({ id, code: `FOR-2026-000${id}`, year: 2026, name: `Formación ${id}`, planningType: "PLANNED", trainingTypeId: "type-quality", isGmp: false, originType: "INTERNAL", createdByUserId: "admin", createdAt: base, updatedAt: base, ...partial });
const attendance = (id: string, status: Attendance["attendanceStatus"], result: Attendance["result"], notes?: string): Attendance => ({ id, sessionId: `s${id}`, personId: "p1", attendanceStatus: status, result, notes, createdAt: base, updatedAt: base });
const session = (id: string, trainingId: string, date: string, item: Attendance): TrainingSession => ({ id: `s${id}`, trainingId, code: `FOR-2026-000${trainingId}-S0${id}`, plannedDate: date, executionDate: date, trainerPersonId: "p1", durationMinutes: 60, executionStatus: "EXECUTED", createdAt: base, updatedAt: base, attendances: [{ ...item, sessionId: `s${id}` }] });
const setup = (trainings: Training[], sessions: TrainingSession[], seedPeople: Person[] = [person]) => { const people = new InMemoryPeopleRepository(seedPeople); const trainingRepo = new InMemoryTrainingRepository(trainings); return new PersonHistoryService(trainingRepo, new InMemorySessionRepository(trainingRepo, people, sessions), people); };

describe("historial individual", () => {
  it("incluye ATTENDED + PASS", async () => expect((await setup([training("1")], [session("1", "1", "2026-02-01", attendance("1", "ATTENDED", "PASS"))]).get("p1", admin)).rows[0].result).toBe("PASS"));
  it("incluye ATTENDED + FAIL y observaciones", async () => expect((await setup([training("1")], [session("1", "1", "2026-02-01", attendance("1", "ATTENDED", "FAIL", "Refuerzo"))]).get("p1", admin)).rows[0]).toMatchObject({ result: "FAIL", observations: "Refuerzo", renewalDate: undefined }));
  it.each([["NOT_ATTENDED", "NOT_APPLICABLE"], ["EXPECTED", "PENDING"]] as const)("excluye %s", async (status, result) => expect((await setup([training("1")], [session("1", "1", "2026-02-01", attendance("1", status, result))]).get("p1", admin)).rows).toHaveLength(0));
  it("conserva historial de persona inactiva", async () => { const inactive = { ...person, active: false }; expect((await setup([training("1")], [session("1", "1", "2026-02-01", attendance("1", "ATTENDED", "PASS"))], [inactive]).get("p1", admin)).rows).toHaveLength(1); });
  it("filtra múltiples años por executionDate", async () => { const sessions = [session("1", "1", "2025-12-31", attendance("1", "ATTENDED", "PASS")), session("2", "1", "2026-01-01", attendance("2", "ATTENDED", "PASS"))]; expect((await setup([training("1")], sessions).get("p1", admin, 2026)).rows.map((row) => row.executionDate)).toEqual(["2026-01-01"]); });
  it("ofrece solo años con formación realmente recibida", async () => { const sessions = [session("1", "1", "2025-12-31", attendance("1", "NOT_ATTENDED", "NOT_APPLICABLE")), session("2", "1", "2026-01-01", attendance("2", "ATTENDED", "PASS"))]; expect((await setup([training("1")], sessions).get("p1", admin)).availableYears).toEqual([2026]); });
  it("ignora Training.year para el año recibido", async () => { const oldPlan = training("1", { year: 2025, code: "FOR-2025-0001" }); expect((await setup([oldPlan], [session("1", "1", "2026-01-15", attendance("1", "ATTENDED", "PASS"))]).get("p1", admin, 2026)).rows).toHaveLength(1); });
  it("calcula renovación de 12 meses", () => expect(addCalendarMonths("2026-02-10", 12)).toBe("2027-02-10"));
  it("calcula cambio de año", () => expect(addCalendarMonths("2026-11-30", 3)).toBe("2027-02-28"));
  it("ajusta final de mes por calendario", () => expect(addCalendarMonths("2024-01-31", 1)).toBe("2024-02-29"));
  it("no calcula renovación con frecuencia vacía", async () => expect((await setup([training("1")], [session("1", "1", "2026-01-01", attendance("1", "ATTENDED", "PASS"))]).get("p1", admin)).rows[0].renewalDate).toBeUndefined());
  it("calcula renovación solo para APTO", async () => { const trainings = [training("1", { frequencyMonths: 12 })]; const pass = await setup(trainings, [session("1", "1", "2026-01-31", attendance("1", "ATTENDED", "PASS"))]).get("p1", admin); const fail = await setup(trainings, [session("1", "1", "2026-01-31", attendance("1", "ATTENDED", "FAIL"))]).get("p1", admin); expect(pass.rows[0].renewalDate).toBe("2027-01-31"); expect(fail.rows[0].renewalDate).toBeUndefined(); });
  it("resuelve departamentos inactivos", async () => { const people = new InMemoryPeopleRepository([person], [{ id: "quality", code: "CAL", name: "Calidad histórica", active: false }]); const trainings = new InMemoryTrainingRepository([training("1")]); const service = new PersonHistoryService(trainings, new InMemorySessionRepository(trainings, people, [session("1", "1", "2026-01-01", attendance("1", "ATTENDED", "PASS"))]), people); expect((await service.get("p1", admin)).department).toBe("Calidad histórica"); });
  it("resuelve el tipo inactivo en historial individual y Anexo V", async () => {
    const catalogs: DemoCatalogStore = { trainingTypes: [{ id: "type-quality", code: "CAL", name: "Calidad histórica", active: false }], modalities: [], evaluationMethods: [], departments: [] };
    const people = new InMemoryPeopleRepository([person]);
    const trainings = new InMemoryTrainingRepository([training("1")], catalogs);
    const service = new PersonHistoryService(trainings, new InMemorySessionRepository(trainings, people, [session("1", "1", "2026-01-01", attendance("1", "ATTENDED", "PASS"))]), people);
    expect((await service.get("p1", admin, undefined, true)).rows[0].trainingType).toBe("Calidad histórica");
  });
  it("admite datos externos", async () => { const external = { ...person, personType: "EXTERNAL" as const, departmentId: undefined, company: "Empresa ficticia" }; expect((await setup([], [], [external]).get("p1", admin)).person.company).toBe("Empresa ficticia"); });
  it("ordena UI descendente y Anexo ascendente con desempate estable", async () => { const trainings = [training("1", { code: "FOR-2026-0002" }), training("2", { code: "FOR-2026-0001" })]; const sessions = [session("1", "1", "2026-05-01", attendance("1", "ATTENDED", "PASS")), session("2", "2", "2026-05-01", attendance("2", "ATTENDED", "PASS"))]; const service = setup(trainings, sessions); expect((await service.get("p1", admin)).rows.map((row) => row.trainingCode)).toEqual(["FOR-2026-0001", "FOR-2026-0002"]); expect((await service.get("p1", admin, undefined, true)).rows.map((row) => row.trainingCode)).toEqual(["FOR-2026-0001", "FOR-2026-0002"]); });
  it("devuelve historial vacío", async () => expect((await setup([], []).get("p1", admin)).rows).toEqual([]));
  it("deniega historial completo a USER", async () => expect(setup([], []).get("p1", user)).rejects.toThrow("autorizado"));
});
