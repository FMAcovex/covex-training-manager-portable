import { afterEach, describe, expect, it, vi } from "vitest";
import { desktopRequestRejection } from "./desktop-policy";
import { readDemoJson, writeDemoJson } from "@/demo/demo-data-store";

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
  it.each(["/api/admin/training-import", "/api/admin/trainer-import", "/api/trainers/documents", "/api/people", "/api/sessions/synthetic/document-control/attachments"])("blocks real input in desktop demo: %s", (path) => {
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
  it("never loads or persists local data in the desktop demonstration", () => {
    vi.stubEnv("PORTABLE_DESKTOP_MODE", "demo");
    expect(readDemoJson("people-current.json")).toBeUndefined();
    expect(() => writeDemoJson("people-current.json", [])).toThrow("solo lectura");
  });
});
