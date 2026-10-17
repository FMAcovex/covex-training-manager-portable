import { afterEach, describe, expect, it, vi } from "vitest";
import { desktopRequestRejection } from "./desktop-policy";

const secret = "b".repeat(64);
const env = { PORTABLE_DESKTOP_MODE: "demo", PORTABLE_DESKTOP_INSTANCE_ID: "a".repeat(48), PORTABLE_DESKTOP_INSTANCE_TOKEN: secret, APP_ENV: "development", AUTH_MODE: "demo", PERSISTENCE_PROVIDER: "demo", DATABASE_URL: "" };
const request = { path: "/api/people", method: "GET", host: "127.0.0.1:43110", origin: "http://127.0.0.1:43110", cookie: secret };
afterEach(() => vi.unstubAllEnvs());
describe("desktop isolated modes", () => {
  it("does not change H9A/H10B requests outside the desktop launcher", () => expect(desktopRequestRejection(request, {})).toBeUndefined());
  it("requires the exact host and unpredictable local session cookie", () => {
    expect(desktopRequestRejection({ ...request, cookie: undefined }, env)?.status).toBe(401);
    expect(desktopRequestRejection({ ...request, host: "attacker.invalid" }, env)?.status).toBe(403);
    expect(desktopRequestRejection({ ...request, cookie: "forged" }, env)?.status).toBe(401);
    expect(desktopRequestRejection(request, { ...env, PORTABLE_DESKTOP_INSTANCE_TOKEN: "" })?.status).toBe(503);
  });
  it.each(["/api/admin/training-import", "/api/admin/trainer-import", "/api/trainers/documents", "/api/admin/users", "/api/trainings/id/close", "/api/people/id/activate", "/api/sessions/synthetic/document-control/attachments", "/api/sessions/id/not-executed", "/api/trainings/id/sessions/extra", "/api/sessions/id%2Fother/finalize", "/api/sessions/id/../finalize", "/api/portable/session"])("blocks unauthorized input in desktop demo: %s", (path) => {
    expect(desktopRequestRejection({ ...request, method: "POST", path }, env)?.status).toBe(403);
  });
  it("allows synthetic annex generation but rejects cross-origin requests and corporate APIs", () => {
    const annex = { ...request, method: "POST", path: "/api/sessions/session-demo-1/annex-iii" };
    expect(desktopRequestRejection(annex, env)).toBeUndefined();
    expect(desktopRequestRejection({ ...annex, origin: "https://attacker.invalid" }, env)?.status).toBe(403);
    expect(desktopRequestRejection({ ...request, path: "/api/portable/config" }, env)?.status).toBe(403);
    expect(desktopRequestRejection(request, { ...env, DATABASE_URL: "postgresql://forbidden" })?.status).toBe(503);
    expect(desktopRequestRejection(request, { ...env, PORTABLE_DESKTOP_MODE: "corporate" })?.status).toBe(503);
  });
  it.each([
    ["POST", "/api/people"], ["POST", "/api/trainings"], ["PATCH", "/api/trainings/synthetic-1"],
    ["POST", "/api/trainings/synthetic-1/sessions"], ["PATCH", "/api/sessions/synthetic-1"],
    ["POST", "/api/sessions/synthetic-1/finalize"], ["POST", "/api/sessions/synthetic-1/reopen"],
    ["POST", "/api/sessions/synthetic-1/annex-iii"], ["POST", "/api/annual-plan/2026/annex-iv"], ["POST", "/api/people/synthetic-1/annex-v"],
  ])("permits only the exact synthetic workflow: %s %s", (method, path) => {
    expect(desktopRequestRejection({ ...request, method, path }, env)).toBeUndefined();
    for (const origin of [null, "null", "http://localhost:43110", "https://attacker.invalid"]) expect(desktopRequestRejection({ ...request, method, path, origin }, env)?.status).toBe(403);
    for (const wrongMethod of ["PUT", "DELETE", "TRACE", method === "PATCH" ? "POST" : "PATCH"]) expect(desktopRequestRejection({ ...request, method: wrongMethod, path }, env)?.status).toBe(403);
  });
  it("preserves corporate H10C policy and never enables demo writes for mixed configurations", () => {
    const corporate = { ...env, PORTABLE_DESKTOP_MODE: "corporate", APP_ENV: "production", AUTH_MODE: "portable-entra", PERSISTENCE_PROVIDER: "portable-sharepoint" };
    expect(desktopRequestRejection({ ...request, method: "POST", path: "/api/admin/training-import" }, corporate)).toBeUndefined();
    for (const change of [{ APP_ENV: "production" }, { AUTH_MODE: "portable-entra" }, { PERSISTENCE_PROVIDER: "portable-sharepoint" }, { DATABASE_URL: "postgresql://forbidden" }]) expect(desktopRequestRejection({ ...request, method: "POST" }, { ...env, ...change })?.status).toBe(503);
  });
});
