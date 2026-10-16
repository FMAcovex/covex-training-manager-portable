import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryPortableEntityStore } from "./entity-store";
import { createPortableProvider } from "./provider";
import { previewTrainingImport, commitTrainingImport } from "@/imports/training-import-service";

const fixture = vi.hoisted(() => ({ provider: undefined as unknown as ReturnType<typeof createPortableProvider> }));
vi.mock("@/portable/sharepoint/provider", async (original) => ({ ...await original<object>(), getPortableProvider: () => fixture.provider }));
vi.mock("@/server/people-repositories", () => ({ getPeopleRepository: () => fixture.provider.people }));
vi.mock("@/server/training-repositories", () => ({ getTrainingRepository: () => fixture.provider.trainings }));
vi.mock("@/server/session-repositories", () => ({ getSessionRepository: () => fixture.provider.sessions }));
vi.mock("@/administration/repositories", () => ({ getAuditEventRepository: () => fixture.provider.audit }));
vi.mock("read-excel-file/node", () => ({ readSheet: async (_buffer: Buffer, sheet: string) => sheet === "Personal" ? [
  ["ID empleado", "Nombre completo", "Departamento", "Puesto", "Activo", "Observaciones"],
  ["SYN-HIST-1", "Persona histórica sintética", "Calidad", "Técnico", "No", "Sintético"],
] : sheet === "Sesiones" ? [
  ["ID sesión", "Fecha PREVISTA", "Fecha EJECUCIÓN", "Nombre formación", "Tipo", "Motivo si no planificada", "Colectivo objetivo", "Formador", "Frecuencia (meses)", "Versión material/PNT", "PRESENCIAL/ONLINE", "Planificación", "GMP", "Interna/Externa", "Duración (h)", "Estado ejecución", "Observaciones", "Contenido del curso"],
  ["SYN-S1", "2026-02-10", "2026-02-10", "Curso histórico sintético", "Inicial", null, "Grupo sintético", "Persona histórica sintética", 12, "SYN-DOC", "Presencial", "Planificada", "Sí", "Interna", 1, "Ejecutada", null, "Contenido sintético"],
] : [
  ["ID sesión", "Empleado", "Departamento", "Puesto", "Estado asistencia", "Resultado", "Observaciones"],
  ["SYN-S1", "Persona histórica sintética", "Calidad", "Técnico", "Asiste", "Apto", null],
] }));

afterEach(() => vi.unstubAllEnvs());

describe("H10B controlled historical import", () => {
  it("imports the full aggregate including an inactive historical trainer and records its fingerprint", async () => {
    vi.stubEnv("APP_ENV", "production"); vi.stubEnv("AUTH_MODE", "portable-entra"); vi.stubEnv("PERSISTENCE_PROVIDER", "portable-sharepoint");
    vi.stubEnv("PORTABLE_ENTRA_TENANT_ID", "11111111-1111-4111-8111-111111111111"); vi.stubEnv("PORTABLE_ENTRA_CLIENT_ID", "22222222-2222-4222-8222-222222222222");
    vi.stubEnv("PORTABLE_ENTRA_REDIRECT_URI", "http://127.0.0.1:43110/acceso-denegado"); vi.stubEnv("PORTABLE_SHAREPOINT_SITE_ID", "synthetic"); vi.stubEnv("PORTABLE_SHAREPOINT_DOCUMENT_DRIVE_ID", "synthetic"); vi.stubEnv("PORTABLE_SHAREPOINT_LIST_PREFIX", "COVEX");
    const raw = new InMemoryPortableEntityStore();
    await raw.create("Department", "quality", { id: "quality", code: "GC", name: "Calidad", active: true });
    await raw.create("TrainingType", "initial", { id: "initial", code: "INI", name: "Inicial", active: true });
    await raw.create("Modality", "onsite", { id: "onsite", code: "PRE", name: "Presencial", active: true });
    fixture.provider = createPortableProvider(raw);
    const buffer = Buffer.from("synthetic-historical-workbook");
    const preview = await previewTrainingImport(buffer, "synthetic.xlsx");
    expect(preview.canCommit).toBe(true);
    const result = await commitTrainingImport(buffer, "synthetic.xlsx", preview.suggestedMappings, { id: "actor", displayName: "Administrador sintético", role: "ADMIN" });
    expect(result.counts).toMatchObject({ trainings: 1, sessions: 1, attendances: 1 });
    expect(await raw.list("TrainingImportRun")).toHaveLength(1);
    expect(await fixture.provider.people.list()).toMatchObject([{ active: false }]);
    expect(await fixture.provider.sessions.listAll()).toMatchObject([{ executionStatus: "EXECUTED", attendances: [{ attendanceStatus: "ATTENDED", result: "PASS" }] }]);
    await expect(commitTrainingImport(buffer, "synthetic.xlsx", preview.suggestedMappings, { id: "actor", displayName: "Administrador sintético", role: "ADMIN" })).rejects.toThrow();
    expect(await raw.list("Training")).toHaveLength(1);
  });
});
