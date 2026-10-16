import { describe, expect, it } from "vitest";
import { InMemoryAuditEventRepository } from "@/administration/audit-repository";
import { InMemoryUserProfileRepository } from "@/administration/user-profile-repository";
import { AuthenticationError, resolveAppServiceUser } from "./request-user";

const repository = () => new InMemoryUserProfileRepository(new InMemoryAuditEventRepository(), [
  {
    id: "admin-1",
    entraObjectId: "entra-admin",
    email: "admin@example.test",
    displayName: "Admin",
    role: "ADMIN",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "inactive-1",
    entraObjectId: "entra-inactive",
    email: "inactive@example.test",
    displayName: "Inactivo",
    role: "USER",
    active: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
]);

describe("identidad App Service", () => {
  it("resuelve el UserProfile activo por entraObjectId", async () => {
    await expect(resolveAppServiceUser("entra-admin", repository())).resolves.toEqual({
      id: "admin-1",
      displayName: "Admin",
      role: "ADMIN",
    });
  });

  it("rechaza cabecera ausente como no autenticada", async () => {
    await expect(resolveAppServiceUser(undefined, repository())).rejects.toMatchObject({
      status: 401,
    } satisfies Partial<AuthenticationError>);
  });

  it("rechaza usuario corporativo no registrado", async () => {
    await expect(resolveAppServiceUser("missing", repository())).rejects.toMatchObject({
      status: 403,
    } satisfies Partial<AuthenticationError>);
  });

  it("rechaza perfiles inactivos", async () => {
    await expect(resolveAppServiceUser("entra-inactive", repository())).rejects.toMatchObject({
      status: 403,
    } satisfies Partial<AuthenticationError>);
  });
});
