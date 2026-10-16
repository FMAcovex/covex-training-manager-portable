import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppRole } from "@/auth/current-user";

let role: AppRole = "ADMIN";
vi.mock("@/auth/current-user", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/auth/current-user")>();
  return { ...original, getCurrentUser: () => ({ id: `actor-${role}`, displayName: "Actor ficticio", role }) };
});

describe("autorización de rutas API administrativas", () => {
  beforeEach(() => { role = "ADMIN"; });
  it.each(["USER", "RESPONSIBLE"] as const)("GET /api/admin/users devuelve 403 a %s", async (candidate) => { role = candidate; const { GET } = await import("./users/route"); expect((await GET()).status).toBe(403); });
  it.each(["USER", "RESPONSIBLE"] as const)("GET /api/admin/catalogs/[kind] devuelve 403 a %s", async (candidate) => { role = candidate; const { GET } = await import("./catalogs/[kind]/route"); const response = await GET(new Request("http://localhost/api/admin/catalogs/training-types"), { params: Promise.resolve({ kind: "training-types" }) }); expect(response.status).toBe(403); });
  it.each(["USER", "RESPONSIBLE"] as const)("POST /api/admin/training-import devuelve 403 a %s", async (candidate) => { role = candidate; const { POST } = await import("./training-import/route"); const response = await POST(new Request("http://localhost/api/admin/training-import", { method: "POST" })); expect(response.status).toBe(403); });
});

describe("paginación de auditoría", () => {
  it("aplica 100/0 cuando faltan parámetros", async () => {
    const { parseAuditPagination } = await import("./audit-events/pagination");
    expect(parseAuditPagination(new URLSearchParams())).toEqual({ limit: 100, offset: 0 });
  });

  it("limita el tamaño máximo a 200", async () => {
    const { parseAuditPagination } = await import("./audit-events/pagination");
    expect(parseAuditPagination(new URLSearchParams("limit=999&offset=12"))).toEqual({ limit: 200, offset: 12 });
  });

  it("normaliza valores inválidos de forma predecible", async () => {
    const { parseAuditPagination } = await import("./audit-events/pagination");
    expect(parseAuditPagination(new URLSearchParams("limit=0&offset=-1"))).toEqual({ limit: 100, offset: 0 });
    expect(parseAuditPagination(new URLSearchParams("limit=no-numero&offset=1.5"))).toEqual({ limit: 100, offset: 0 });
  });
});
