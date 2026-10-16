import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/auth/current-user";
import { InMemoryAuditEventRepository } from "./audit-repository";
import { InMemoryUserProfileRepository } from "./user-profile-repository";
import { InMemoryCatalogAdminRepository } from "./catalog-repository";
import type { DemoCatalogStore } from "./demo-catalog-store";
import { InMemoryTrainingRepository } from "@/server/training-repository";
import { InMemoryPeopleRepository } from "@/server/people-repository";
import { InMemoryAnnexRepository } from "@/annexes/annex-repository";
import type { TemplateVersion } from "@/annexes/types";
import { SUPPORTED_DEVELOPMENT_FIXTURES } from "@/annexes/supported-fixtures";
import { AdminConflictError, catalogCreateSchema, templateUpdateSchema, userUpdateSchema } from "./types";

const admin: CurrentUser = { id: "admin-active", displayName: "Admin ficticio", role: "ADMIN" };
const profiles = [
  { id: "admin-active", entraObjectId: "entra-admin", email: "admin@example.test", displayName: "Admin", role: "ADMIN" as const, active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "user", entraObjectId: "entra-user", email: "user@example.test", displayName: "User", role: "USER" as const, active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

describe("administración de UserProfile", () => {
  const setup = () => { const audit = new InMemoryAuditEventRepository(); return { audit, repository: new InMemoryUserProfileRepository(audit, profiles) }; };
  it("crea perfiles sin contraseñas y audita el alta", async () => { const { repository, audit } = setup(); const created = await repository.create({ entraObjectId: "new-entra", email: "new@example.test", displayName: "Nuevo", role: "RESPONSIBLE", active: true }, admin); expect(created).toMatchObject({ role: "RESPONSIBLE", active: true }); expect(await audit.list({ action: "USER_PROFILE_CREATED" })).toHaveLength(1); });
  it("rechaza email duplicado", async () => { const { repository } = setup(); await expect(repository.create({ entraObjectId: "other", email: "USER@example.test", displayName: "Duplicado", role: "USER", active: true }, admin)).rejects.toBeInstanceOf(AdminConflictError); });
  it("rechaza entraObjectId duplicado", async () => { const { repository } = setup(); await expect(repository.create({ entraObjectId: "entra-user", email: "other@example.test", displayName: "Duplicado", role: "USER", active: true }, admin)).rejects.toBeInstanceOf(AdminConflictError); });
  it("permite USER -> RESPONSIBLE -> ADMIN y deja eventos inequívocos", async () => { const { repository, audit } = setup(); await repository.update("user", { role: "RESPONSIBLE" }, admin); await repository.update("user", { role: "ADMIN" }, admin); expect((await repository.findById("user"))?.role).toBe("ADMIN"); expect(await audit.list({ action: "USER_ROLE_CHANGED" })).toHaveLength(2); });
  it("activa y desactiva sin borrar físicamente", async () => { const { repository, audit } = setup(); await repository.update("user", { active: false }, admin); expect(await repository.findById("user")).toMatchObject({ active: false }); await repository.update("user", { active: true }, admin); expect(await repository.list()).toHaveLength(2); expect((await audit.list()).map((e) => e.action)).toEqual(expect.arrayContaining(["USER_DEACTIVATED", "USER_ACTIVATED"])); });
  it("impide dejar el sistema sin ADMIN activo", async () => { const { repository } = setup(); await expect(repository.update("admin-active", { active: false }, admin)).rejects.toBeInstanceOf(AdminConflictError); await expect(repository.update("admin-active", { role: "USER" }, admin)).rejects.toBeInstanceOf(AdminConflictError); });
  it("entraObjectId es inmutable en el contrato PATCH strict", () => expect(userUpdateSchema.safeParse({ entraObjectId: "changed" }).success).toBe(false));
});

describe("administración de catálogos compartidos", () => {
  const setup = () => {
    const store: DemoCatalogStore = { trainingTypes: [{ id: "used-type", code: "USED", name: "Usado", active: true }], modalities: [], evaluationMethods: [], departments: [{ id: "used-dept", code: "DEP", name: "Usado", active: true }] };
    const training = new InMemoryTrainingRepository([{ id: "training", code: "FOR-2026-0001", year: 2026, name: "Demo", planningType: "PLANNED", trainingTypeId: "used-type", isGmp: false, originType: "EXTERNAL", createdByUserId: "admin", createdAt: "", updatedAt: "" }], store);
    const people = new InMemoryPeopleRepository([{ id: "person", fullName: "Demo", personType: "INTERNAL", departmentId: "used-dept", jobTitle: "Demo", active: true }], store);
    const audit = new InMemoryAuditEventRepository(); return { store, training, people, audit, repository: new InMemoryCatalogAdminRepository(audit, training, people, store) };
  };
  it.each(["training-types", "modalities", "evaluation-methods", "departments"] as const)("crea %s y audita", async (kind) => { const { repository, audit } = setup(); await repository.create(kind, { code: `NEW-${kind}`, name: "Nuevo", active: true }, admin); expect(await audit.list({ action: "CATALOG_CREATED" })).toHaveLength(1); });
  it("mantiene código único e inmutable", async () => { const { repository } = setup(); await expect(repository.create("training-types", { code: "used", name: "Duplicado", active: true }, admin)).rejects.toBeInstanceOf(AdminConflictError); expect(catalogCreateSchema.parse({ code: "abc", name: "Nombre" }).code).toBe("ABC"); });
  it("impide renombrar un elemento referenciado y permite desactivarlo", async () => { const { repository } = setup(); await expect(repository.update("training-types", "used-type", { name: "Alterado" }, admin)).rejects.toBeInstanceOf(AdminConflictError); expect(await repository.update("training-types", "used-type", { active: false }, admin)).toMatchObject({ active: false, referenced: true }); });
  it("permite corregir el nombre sin referencias", async () => { const { repository } = setup(); const item = await repository.create("modalities", { code: "NEW", name: "Original", active: true }, admin); expect(await repository.update("modalities", item.id, { name: "Corregido" }, admin)).toMatchObject({ name: "Corregido" }); });
  it("los inactivos desaparecen de selecciones nuevas pero siguen resolviendo históricos", async () => { const { repository, training } = setup(); await repository.update("training-types", "used-type", { active: false }, admin); expect((await training.listCatalogs()).trainingTypes).toHaveLength(0); expect((await repository.list("training-types"))[0]).toMatchObject({ id: "used-type", active: false, referenced: true }); });
});

describe("administración de TemplateVersion", () => {
  const fixture: TemplateVersion = { id: "v1", ...SUPPORTED_DEVELOPMENT_FIXTURES.ANNEX_III, effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: "2026-12-31T23:59:59.000Z", active: true, createdAt: "2026-01-01T00:00:00.000Z" };
  const setup = () => { const audit = new InMemoryAuditEventRepository(); return { audit, repository: new InMemoryAnnexRepository([fixture], audit) }; };
  it("lista y registra metadata sin archivos", async () => { const { repository } = setup(); await repository.registerTemplateVersion({ annexType: "ANNEX_IV", procedureCode: "PNT", templateVersion: "2", storageProvider: "SHAREPOINT", storageReference: "sharepoint://future", effectiveFrom: "2027-01-01T00:00:00.000Z", active: false }, admin); expect(await repository.listAllTemplateVersions()).toHaveLength(2); });
  it("trata campos identificativos como inmutables en PATCH", () => expect(templateUpdateSchema.safeParse({ procedureCode: "otro" }).success).toBe(false));
  it("impide solapamiento activo y permite ventanas no solapadas", async () => {
    const overlapping = { ...fixture, id: "v2", effectiveFrom: "2026-06-01T00:00:00.000Z", effectiveTo: undefined, active: false };
    const repository = new InMemoryAnnexRepository([fixture, overlapping]);
    await expect(repository.updateTemplateVersion("v2", { active: true }, admin)).rejects.toBeInstanceOf(AdminConflictError);
    await expect(repository.updateTemplateVersion("v2", { effectiveFrom: "2027-01-01T00:00:00.000Z", active: true }, admin)).resolves.toMatchObject({ active: true });
  });
  it("impide activar proveedores no soportados con mensaje claro", async () => { const { repository } = setup(); const row = await repository.registerTemplateVersion({ annexType: "ANNEX_V", procedureCode: "PNT", templateVersion: "SP", storageProvider: "SHAREPOINT", storageReference: "sharepoint://future", effectiveFrom: "2027-01-01T00:00:00.000Z", active: false }, admin); await expect(repository.updateTemplateVersion(row.id, { active: true }, admin)).rejects.toThrow("proveedor de almacenamiento todavía no está soportado"); });
  it.each([
    ["procedureCode", { procedureCode: "RH-00/003/99" }],
    ["templateVersion", { templateVersion: "TEST-OTRA" }],
  ])("impide activar metadata de fixture con %s no soportado", async (_field, override) => {
    const candidate = { ...fixture, ...override, id: "invalid", active: false };
    const repository = new InMemoryAnnexRepository([candidate]);
    await expect(repository.updateTemplateVersion("invalid", { active: true }, admin)).rejects.toBeInstanceOf(AdminConflictError);
  });
  it("audita activación/desactivación y conserva GeneratedDocument histórico", async () => { const { repository, audit } = setup(); await repository.updateTemplateVersion("v1", { active: false }, admin); const generated = await repository.createGeneratedDocument({ annexType: "ANNEX_III", templateVersionId: "v1", sessionId: "session", generatedByUserId: admin.id }); expect(generated.templateVersionId).toBe("v1"); expect(await audit.list({ action: "TEMPLATE_VERSION_DEACTIVATED" })).toHaveLength(1); });
});

describe("AuditEvent append-only y consulta", () => {
  it("ordena descendente, filtra y limita a máximo 200", async () => { const repository = new InMemoryAuditEventRepository(); for (let index = 0; index < 205; index++) await repository.append({ actorUserId: index % 2 ? "a" : "b", entityType: "ENTITY", entityId: String(index), action: index % 2 ? "ODD" : "EVEN" }); const rows = await repository.list({ action: "ODD", actorUserId: "a", limit: 999 }); expect(rows.length).toBeLessThanOrEqual(200); expect(rows.every((row) => row.action === "ODD" && row.actorUserId === "a")).toBe(true); expect(rows[0].timestamp >= rows.at(-1)!.timestamp).toBe(true); });
  it("solo expone append/list, sin update ni delete", () => { const repository = new InMemoryAuditEventRepository() as unknown as Record<string, unknown>; expect(repository.update).toBeUndefined(); expect(repository.delete).toBeUndefined(); });
});
