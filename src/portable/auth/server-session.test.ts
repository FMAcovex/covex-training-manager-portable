import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "@/auth/errors";
import type { GraphClient } from "@/portable/graph/graph-client";
import { clearPortableSessionsForTests, createPortableSession, findPortableSession } from "./server-session";

const tenantId = "11111111-1111-4111-8111-111111111111";
const clientId = "22222222-2222-4222-8222-222222222222";
const objectId = "33333333-3333-4333-8333-333333333333";

afterEach(() => { vi.unstubAllEnvs(); clearPortableSessionsForTests(); });

function configure() {
  vi.stubEnv("PORTABLE_ENTRA_TENANT_ID", tenantId);
  vi.stubEnv("PORTABLE_ENTRA_CLIENT_ID", clientId);
  vi.stubEnv("PORTABLE_ENTRA_REDIRECT_URI", "http://127.0.0.1:43110/acceso-denegado");
}

describe("portable server session", () => {
  it("binds the verified ID token to the delegated Graph identity and keeps the token server-side", async () => {
    configure(); const now = Date.now();
    const graph = { requestJson: vi.fn().mockResolvedValue({ id: objectId, displayName: "Usuario sintético", mail: "synthetic@example.invalid" }) } as unknown as GraphClient;
    const session = await createPortableSession({ accessToken: "a".repeat(120), idToken: "i".repeat(120) }, {
      now,
      graph,
      verify: async () => ({ tid: tenantId, oid: objectId, exp: Math.floor((now + 120_000) / 1000), iat: Math.floor(now / 1000), aud: clientId, iss: `https://login.microsoftonline.com/${tenantId}/v2.0` }),
    });
    expect(session).toMatchObject({ entraObjectId: objectId, tenantId, displayName: "Usuario sintético" });
    expect(findPortableSession(session.id, now)).toMatchObject({ accessToken: "a".repeat(120) });
    expect(findPortableSession(session.id, now + 121_000)).toBeUndefined();
  });

  it("rejects an access token belonging to another object id", async () => {
    configure(); const now = Date.now();
    const graph = { requestJson: vi.fn().mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" }) } as unknown as GraphClient;
    await expect(createPortableSession({ accessToken: "a".repeat(120), idToken: "i".repeat(120) }, {
      now,
      graph,
      verify: async () => ({ tid: tenantId, oid: objectId, exp: Math.floor((now + 120_000) / 1000), iat: Math.floor(now / 1000) }),
    })).rejects.toBeInstanceOf(AuthenticationError);
  });
});
