import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/auth/current-user";
import type { Training } from "@/domain/training";
import type { TrainingSession } from "@/domain/training-session";
import { InMemoryPeopleRepository } from "@/server/people-repository";
import { InMemorySessionRepository } from "@/server/session-repository";
import { InMemoryTrainingRepository } from "@/server/training-repository";
import { AnnualPlanService } from "@/annual-plan/annual-plan-service";
import type { DemoCatalogStore } from "@/administration/demo-catalog-store";

const admin = { id: "admin", displayName: "Admin", role: "ADMIN" } as CurrentUser;
const user = { id: "user", displayName: "Usuario", role: "USER" } as CurrentUser;
const base = "2026-01-01T00:00:00.000Z";
const training = (id: string, code: string, partial: Partial<Training> = {}): Training => ({ id, code, year: 2026, name: `Curso ${id}`, planningType: "PLANNED", isGmp: false, originType: "INTERNAL", plannedTrainerPersonId: "demo-1", createdByUserId: "admin", createdAt: base, updatedAt: base, ...partial });
const session = (id: string, trainingId: string, code: string, partial: Partial<TrainingSession> = {}): TrainingSession => ({ id, trainingId, code, plannedDate: "2026-06-01", trainerPersonId: "demo-1", durationMinutes: 60, executionStatus: "PENDING", createdAt: base, updatedAt: base, attendances: [], ...partial });

const setup = (trainings: Training[], sessions: TrainingSession[]) => {
  const people = new InMemoryPeopleRepository();
  const trainingRepo = new InMemoryTrainingRepository(trainings);
  return new AnnualPlanService(trainingRepo, new InMemorySessionRepository(trainingRepo, people, sessions), people);
};

const historicalCatalogs: DemoCatalogStore = {
  trainingTypes: [{ id: "historical-type", code: "HIS", name: "Tipo histórico", active: false }],
  modalities: [], evaluationMethods: [], departments: [],
};

describe("proyección del Plan anual", () => {
  it("crea fila provisional para planificada sin sesión", async () => { const plan = await setup([training("t1", "FOR-2026-0001", { plannedDurationMinutes: 90, targetGroup: "Calidad" })], []).get(2026, admin); expect(plan.planned[0]).toMatchObject({ provisional: true, status: "PENDING", durationMinutes: 90, plannedDate: undefined }); });
  it("sustituye la provisional por una sesión", async () => { const plan = await setup([training("t1", "FOR-2026-0001")], [session("s1", "t1", "FOR-2026-0001-S01")]).get(2026, admin); expect(plan.planned).toHaveLength(1); expect(plan.planned[0]).toMatchObject({ sessionId: "s1", provisional: false }); });
  it("proyecta una fila por sesión", async () => { const plan = await setup([training("t1", "FOR-2026-0001")], [session("s1", "t1", "FOR-2026-0001-S01"), session("s2", "t1", "FOR-2026-0001-S02")]).get(2026, admin); expect(plan.planned).toHaveLength(2); });
  it("mantiene toda la formación pendiente mientras quede una sesión pendiente", async () => {
    const plan = await setup([training("t1", "FOR-2026-0001")], [
      session("s1", "t1", "FOR-2026-0001-S01", { executionStatus: "EXECUTED", executionDate: "2026-05-01" }),
      session("s2", "t1", "FOR-2026-0001-S02", { executionStatus: "PENDING" }),
    ]).get(2026, admin);
    expect(plan.planned.map((row) => row.status)).toEqual(["PENDING", "PENDING"]);
    expect(plan.summary).toMatchObject({ totalPlanned: 1, plannedExecuted: 0, pendingPlanned: 1 });
  });
  it("aplica la misma regla global a formaciones no planificadas", async () => {
    const plan = await setup([training("t1", "FOR-2026-0001", { planningType: "UNPLANNED", reason: "Sobrevenida" })], [
      session("s1", "t1", "FOR-2026-0001-S01", { executionStatus: "EXECUTED", executionDate: "2026-05-01" }),
      session("s2", "t1", "FOR-2026-0001-S02", { executionStatus: "PENDING" }),
    ]).get(2026, admin);
    expect(plan.unplanned.map((row) => row.status)).toEqual(["PENDING", "PENDING"]);
    expect(plan.summary.unplannedExecuted).toBe(0);
  });
  it.each(["PENDING", "EXECUTED", "NOT_EXECUTED"] as const)("conserva estado %s", async (status) => { const plan = await setup([training("t1", "FOR-2026-0001")], [session("s1", "t1", "FOR-2026-0001-S01", { executionStatus: status })]).get(2026, admin); expect(plan.planned[0].status).toBe(status); });
  it("conserva justificación de no ejecución", async () => { const plan = await setup([training("t1", "FOR-2026-0001")], [session("s1", "t1", "FOR-2026-0001-S01", { executionStatus: "NOT_EXECUTED", nonExecutionReason: "Motivo completo" })]).get(2026, admin); expect(plan.planned[0].nonExecutionReason).toBe("Motivo completo"); });
  it("muestra no planificada pendiente en UI", async () => { const plan = await setup([training("t1", "FOR-2026-0001", { planningType: "UNPLANNED", reason: "Sobrevenida" })], [session("s1", "t1", "FOR-2026-0001-S01")]).get(2026, admin); expect(plan.unplanned[0].status).toBe("PENDING"); });
  it("aísla por Training.year aunque executionDate sea de otro año", async () => { const plan = await setup([training("t1", "FOR-2026-0001")], [session("s1", "t1", "FOR-2026-0001-S01", { executionDate: "2027-01-15", executionStatus: "EXECUTED" })]).get(2026, admin); expect(plan.planned).toHaveLength(1); expect((await setup([training("t1", "FOR-2026-0001")], []).get(2025, admin)).planned).toHaveLength(0); });
  it("ordena planificadas por fecha, sin fecha al final y por códigos", async () => { const trainings = [training("a", "FOR-2026-0002"), training("b", "FOR-2026-0001"), training("c", "FOR-2026-0003")]; const sessions = [session("a1", "a", "FOR-2026-0002-S01", { plannedDate: "2026-05-02" }), session("b1", "b", "FOR-2026-0001-S02", { plannedDate: "2026-05-01" })]; const plan = await setup(trainings, sessions).get(2026, admin); expect(plan.planned.map((row) => row.trainingCode)).toEqual(["FOR-2026-0001", "FOR-2026-0002", "FOR-2026-0003"]); });
  it("ordena no planificadas ejecutadas por fecha real", async () => { const trainings = [training("a", "FOR-2026-0001", { planningType: "UNPLANNED", reason: "A" }), training("b", "FOR-2026-0002", { planningType: "UNPLANNED", reason: "B" })]; const sessions = [session("a1", "a", "FOR-2026-0001-S01", { executionStatus: "EXECUTED", executionDate: "2026-06-02" }), session("b1", "b", "FOR-2026-0002-S01", { executionStatus: "EXECUTED", executionDate: "2026-06-01" })]; expect((await setup(trainings, sessions).get(2026, admin)).unplanned.map((row) => row.trainingId)).toEqual(["b", "a"]); });
  it("calcula resumen sin contar NOT_EXECUTED como pendiente", async () => { const trainings = [training("a", "FOR-2026-0001"), training("b", "FOR-2026-0002"), training("c", "FOR-2026-0003")]; const sessions = [session("a1", "a", "A-S01", { executionStatus: "EXECUTED" }), session("b1", "b", "B-S01", { executionStatus: "PENDING" }), session("c1", "c", "C-S01", { executionStatus: "NOT_EXECUTED" })]; const summary = (await setup(trainings, sessions).get(2026, admin)).summary; expect(summary).toMatchObject({ totalPlanned: 3, plannedExecuted: 1, pendingPlanned: 1, allPlannedDelivered: false }); expect(summary.executionPercentage).toBeCloseTo(100 / 3); });
  it("marca todas impartidas solo con total mayor que cero y todo ejecutado", async () => { const yes = await setup([training("a", "FOR-2026-0001")], [session("a1", "a", "A-S01", { executionStatus: "EXECUTED" })]).get(2026, admin); const empty = await setup([], []).get(2026, admin); expect(yes.summary.allPlannedDelivered).toBe(true); expect(empty.summary.allPlannedDelivered).toBeNull(); expect(empty.summary.executionPercentage).toBeNull(); });
  it("calcula última actualización real", async () => { const plan = await setup([training("a", "FOR-2026-0001", { updatedAt: "2026-01-02T00:00:00Z" })], [session("a1", "a", "A-S01", { updatedAt: "2026-03-01T00:00:00Z" })]).get(2026, admin); expect(plan.summary.lastUpdated).toBe("2026-03-01T00:00:00Z"); });
  it("deja última actualización vacía en plan vacío", async () => expect((await setup([], []).get(2026, admin)).summary.lastUpdated).toBeUndefined());
  it("aplica los cinco filtros mínimos", async () => { const plan = await setup([training("a", "FOR-2026-0001", { name: "Curso GMP", isGmp: true, originType: "EXTERNAL", planningType: "UNPLANNED", reason: "X", trainingTypeId: "type-quality", externalTrainerName: "Entidad", plannedTrainerPersonId: undefined })], [session("a1", "a", "A-S01", { executionStatus: "EXECUTED", externalTrainerName: "Entidad", trainerPersonId: undefined })]).get(2026, admin, { search: "gmp", status: "EXECUTED", isGmp: true, originType: "EXTERNAL", trainingTypeId: "type-quality" }); expect(plan.unplanned).toHaveLength(1); });
  it("muestra un formador externo cualificado en una formación interna", async () => { const plan = await setup([training("a", "FOR-2026-0001", { plannedTrainerPersonId: "demo-2" })], [session("a1", "a", "A-S01", { trainerPersonId: "demo-2" })]).get(2026, admin); expect(plan.planned[0].trainer).toBe("Persona Demo Externa"); });
  it("combina persona cualificada y referencia manual en una formación externa", async () => { const plan = await setup([training("a", "FOR-2026-0001", { originType: "EXTERNAL", plannedTrainerPersonIds: ["demo-2"], plannedTrainerPersonId: "demo-2", externalTrainerNames: ["Entidad Ficticia"], externalTrainerName: "Entidad Ficticia" })], [session("a1", "a", "A-S01", { trainerPersonIds: ["demo-2"], trainerPersonId: "demo-2", externalTrainerNames: ["Entidad Ficticia"], externalTrainerName: "Entidad Ficticia" })]).get(2026, admin); expect(plan.planned[0].trainer).toBe("Persona Demo Externa, Entidad Ficticia"); });
  it("resuelve el tipo inactivo de una formación histórica", async () => {
    const people = new InMemoryPeopleRepository();
    const trainingRepo = new InMemoryTrainingRepository([training("a", "FOR-2026-0001", { trainingTypeId: "historical-type" })], historicalCatalogs);
    const service = new AnnualPlanService(trainingRepo, new InMemorySessionRepository(trainingRepo, people, []), people);
    expect((await service.get(2026, admin)).planned[0].trainingType).toBe("Tipo histórico");
  });
  it("permite lectura a USER", async () => expect(setup([], []).get(2026, user)).resolves.toMatchObject({ year: 2026 }));
  it("obtiene del repositorio los años disponibles, incluidos ejercicios futuros", async () => {
    const service = setup([training("a", "FOR-2025-0001", { year: 2025 }), training("b", "FOR-2026-0001"), training("c", "FOR-2028-0001", { year: 2028 })], []);
    await expect(service.getAvailableYears(admin)).resolves.toEqual([2028, 2026, 2025]);
  });
});
