import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  update: vi.fn(),
  trainingStatus: vi.fn(),
}));

vi.mock("@/server/training-repositories", () => ({
  getTrainingRepository: () => ({ findById: mocks.findById, update: mocks.update }),
}));
vi.mock("@/server/session-repositories", () => ({
  getSessionRepository: () => ({ trainingStatus: mocks.trainingStatus }),
}));

import { TrainingConflictError } from "@/server/training-repository";
import { PATCH } from "./route";

const input = { year: 2026, name: "Formación ficticia editada", planningType: "PLANNED", isGmp: false, originType: "INTERNAL" };
const updated = { ...input, id: "training-1", code: "FOR-2026-0001", createdByUserId: "demo-user", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" };

describe("PATCH /api/trainings/[id]", () => {
  beforeEach(() => { mocks.findById.mockReset(); mocks.update.mockReset(); mocks.trainingStatus.mockReset(); });

  it("devuelve la Formación editada con globalStatus recalculado", async () => {
    mocks.findById.mockResolvedValue(updated);
    mocks.update.mockResolvedValue(updated);
    mocks.trainingStatus.mockResolvedValue("EXECUTED");
    const response = await PATCH(new Request("http://localhost/api/trainings/training-1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, expectedUpdatedAt: updated.updatedAt }) }), { params: Promise.resolve({ id: "training-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: "training-1", name: input.name, globalStatus: "EXECUTED" });
    expect(mocks.update).toHaveBeenCalledWith("training-1", expect.objectContaining(input), "demo-user", updated.updatedAt);
    expect(mocks.update).toHaveBeenCalledWith("training-1", expect.objectContaining({
      targetDepartmentIds: [],
      plannedTrainerPersonIds: [],
      externalTrainerNames: [],
    }), "demo-user", updated.updatedAt);
    expect(mocks.trainingStatus).toHaveBeenCalledWith("training-1");
  });

  it("exige la versión original de la Formación", async () => {
    mocks.findById.mockResolvedValue(updated);
    const response = await PATCH(new Request("http://localhost/api/trainings/training-1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }), { params: Promise.resolve({ id: "training-1" }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("versión") });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("devuelve 409 si otro usuario modificó la Formación", async () => {
    mocks.findById.mockResolvedValue(updated);
    mocks.update.mockRejectedValue(new TrainingConflictError());
    const response = await PATCH(new Request("http://localhost/api/trainings/training-1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, expectedUpdatedAt: updated.updatedAt }) }), { params: Promise.resolve({ id: "training-1" }) });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("otro usuario") });
  });
});
