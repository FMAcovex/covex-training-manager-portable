import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn() }));
vi.mock("@/auth/api-user", () => ({ getApiUser: async () => ({ user: { id: "synthetic-admin", role: "ADMIN", displayName: "Ficticio" } }) }));
vi.mock("@/server/session-repositories", () => ({ getSessionRepository: () => ({ findById: mocks.find, update: mocks.update }) }));
vi.mock("@/server/training-repositories", () => ({ getTrainingRepository: () => ({ findById: async () => ({ originType: "EXTERNAL" }) }) }));
vi.mock("@/server/trainer-repositories", () => ({ getTrainerRepository: () => ({}) }));
vi.mock("@/server/trainer-selection", () => ({ validateQualifiedTrainerSelection: async () => undefined }));
import { PATCH } from "./route";
import { SessionConflictError } from "@/server/session-repository";
const input = { trainingId: "training", plannedDate: "2026-10-01", externalTrainerNames: ["Entidad ficticia"], durationMinutes: 60, attendeePersonIds: [] };
const version = "2026-10-01T00:00:00.000Z";
const request = (body: unknown) => new Request("http://localhost/api/sessions/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const context = { params: Promise.resolve({ id: "session" }) };
describe("session stale-edit API contract A01", () => {
  beforeEach(() => { mocks.find.mockReset().mockResolvedValue({ id: "session", trainingId: "training" }); mocks.update.mockReset().mockResolvedValue({ id: "session" }); });
  it.each([input, null, { ...input, expectedUpdatedAt: "invalid" }])("rejects absent/malformed original versions before writing", async (body) => {
    expect((await PATCH(request(body), context))!.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("passes the original client snapshot to the coordinated repository", async () => {
    expect((await PATCH(request({ ...input, expectedUpdatedAt: version }), context))!.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("session", expect.objectContaining(input), expect.objectContaining({ id: "synthetic-admin" }), version);
  });
  it("returns a recoverable 409 rather than accepting stale content", async () => {
    mocks.update.mockRejectedValue(new SessionConflictError());
    const response = (await PATCH(request({ ...input, expectedUpdatedAt: version }), context))!;
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("Conserva tu borrador");
  });
});
