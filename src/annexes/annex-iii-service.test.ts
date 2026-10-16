import { describe, expect, it, vi } from "vitest";
import { AnnexIIIAuthorizationError, AnnexIIINotFoundError, AnnexIIIService } from "@/annexes/annex-iii-service";
import { InMemoryAnnexRepository } from "@/annexes/annex-repository";
import { InMemoryPeopleRepository } from "@/server/people-repository";
import { InMemorySessionRepository } from "@/server/session-repository";
import { InMemoryTrainingRepository } from "@/server/training-repository";

const actor = { id: "demo-user", displayName: "Usuario Demo", role: "ADMIN" as const };
const setup = () => {
  const trainings = new InMemoryTrainingRepository();
  const people = new InMemoryPeopleRepository();
  const sessions = new InMemorySessionRepository(trainings, people);
  const annexes = new InMemoryAnnexRepository();
  return { trainings, people, sessions, annexes, service: new AnnexIIIService(trainings, sessions, people, annexes) };
};

describe("AnnexIIIService", () => {
  it("genera el PDF con nombre basado en el código interno sin modificar el diseño", async () => { const { service } = setup(); const result = await service.generate("session-demo-1", actor, new Date("2026-09-20")); expect(result.filename).toBe("Anexo_III_FOR-2026-0001-S01.pdf"); expect(Buffer.from(result.bytes).subarray(0, 4).toString()).toBe("%PDF"); });
  it("registra la versión de plantilla utilizada", async () => { const { service, annexes } = setup(); const result = await service.generate("session-demo-1", actor, new Date("2026-09-20")); const records = await annexes.listGeneratedDocuments("session-demo-1"); expect(records[0].templateVersionId).toBe(result.templateVersionId); });
  it("crea registros independientes en dos generaciones", async () => { const { service, annexes } = setup(); await service.generate("session-demo-1", actor, new Date("2026-09-20")); await service.generate("session-demo-1", actor, new Date("2026-09-20")); const records = await annexes.listGeneratedDocuments("session-demo-1"); expect(records).toHaveLength(2); expect(records[0].id).not.toBe(records[1].id); });
  it("no cambia Sesión, Attendance ni Training al generar", async () => { const { service, sessions, trainings } = setup(); const beforeSession = await sessions.findById("session-demo-1"); const beforeTraining = await trainings.findById("training-demo-1"); await service.generate("session-demo-1", actor, new Date("2026-09-20")); expect(await sessions.findById("session-demo-1")).toEqual(beforeSession); expect(await trainings.findById("training-demo-1")).toEqual(beforeTraining); });
  it("devuelve error claro para sesión inexistente", async () => { const { service } = setup(); await expect(service.generate("missing", actor)).rejects.toBeInstanceOf(AnnexIIINotFoundError); });
  it("devuelve error claro para formación inexistente", async () => { const { trainings, people, annexes } = setup(); const sessions = { findById: async () => ({ ...(await setup().sessions.findById("session-demo-1"))!, trainingId: "missing" }) } as never; const service = new AnnexIIIService(trainings, sessions, people, annexes); await expect(service.generate("session-demo-1", actor)).rejects.toThrow("Formación asociada no encontrada"); });
  it("aplica autorización en el servicio servidor", async () => { const { service } = setup(); await expect(service.generate("session-demo-1", { ...actor, role: "UNKNOWN" as never })).rejects.toBeInstanceOf(AnnexIIIAuthorizationError); });
  it("solicita departamentos inactivos para conservar nombres históricos", async () => { const { service, people } = setup(); const lookup = vi.spyOn(people, "listDepartments"); await service.generate("session-demo-1", actor, new Date("2026-09-20")); expect(lookup).toHaveBeenCalledWith({ includeInactive: true }); });
  it("solicita tipo, modalidad y evaluación inactivos al generar un Anexo III histórico", async () => { const { service, trainings } = setup(); const lookup = vi.spyOn(trainings, "listCatalogs"); const result = await service.generate("session-demo-1", actor, new Date("2026-09-20")); expect(lookup).toHaveBeenCalledWith({ includeInactive: true }); expect(Buffer.from(result.bytes).subarray(0, 4).toString()).toBe("%PDF"); });
});
