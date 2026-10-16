import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/annexes/annex-services", () => ({ getAnnexIIIService: () => ({ generate: mocks.generate }) }));
vi.mock("@/auth/current-user", async (original) => ({ ...(await original()), getCurrentUser: () => ({ id: "demo-user", displayName: "Usuario Demo", role: "ADMIN" }) }));

import { POST } from "./route";

describe("POST /api/sessions/[id]/annex-iii", () => {
  beforeEach(() => mocks.generate.mockReset());

  it("devuelve PDF descargable con el código de sesión", async () => {
    mocks.generate.mockResolvedValue({ bytes: new Uint8Array(Buffer.from("%PDF-1.4 test")), filename: "Anexo_III_FOR-2026-0001-S01.pdf", generatedDocumentId: "generated-1", templateVersionId: "template-1", pageCount: 1 });
    const response = await POST(new Request("http://localhost/api/sessions/session-1/annex-iii", { method: "POST" }), { params: Promise.resolve({ id: "session-1" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Anexo_III_FOR-2026-0001-S01.pdf"');
    expect(response.headers.get("X-Template-Version-Id")).toBe("template-1");
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");
    expect(mocks.generate).toHaveBeenCalledWith("session-1", { id: "demo-user", displayName: "Usuario Demo", role: "ADMIN" });
  });
});
