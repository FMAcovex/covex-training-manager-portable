import { beforeEach, describe, expect, it, vi } from "vitest";

const workbook = vi.hoisted(() => ({
  people: [
    ["ID empleado", "Nombre completo", "Departamento", "Puesto", "Activo", "Observaciones"],
    ["EMP-DEMO-1", "Persona ficticia", "Calidad", "Técnico/a", "Sí", "Dato ficticio"],
  ],
  sessions: [
    ["ID sesión", "Fecha PREVISTA", "Fecha EJECUCIÓN", "Nombre formación", "Tipo", "Motivo si no planificada", "Colectivo objetivo", "Formador", "Frecuencia (meses)", "Versión material/PNT", "PRESENCIAL/ONLINE", "Planificación", "GMP", "Interna/Externa", "Duración (h)", "Estado ejecución", "Observaciones", "Contenido del curso"],
    ["SES-DEMO-1", new Date("2026-02-10T00:00:00.000Z"), new Date("2026-02-10T00:00:00.000Z"), "Curso ficticio", "Inicial", null, "Equipo demo", "Persona ficticia", 12, "DOC-DEMO", "Presencial", "Planificada", "Sí", "Interna", 1.5, "Ejecutada", null, "Contenido ficticio"],
  ],
  attendances: [
    ["ID sesión", "Empleado", "Departamento", "Puesto", "Estado asistencia", "Resultado", "Observaciones"],
    ["SES-DEMO-1", "Persona ficticia", "Calidad", "Técnico/a", "Asiste", "Apto", null],
    ["SES-DEMO-1", "Persona ficticia", "Calidad", "Técnico/a", "Asiste", "Apto", null],
  ],
}));

vi.mock("read-excel-file/node", () => ({
  readSheet: vi.fn(async (_buffer: Buffer, sheet: string) => sheet === "Personal" ? workbook.people : sheet === "Sesiones" ? workbook.sessions : workbook.attendances),
}));

describe("parseTrainingWorkbook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lee la plantilla y consolida asistencias idénticas repetidas", async () => {
    const { parseTrainingWorkbook } = await import("./training-import-parser");
    const parsed = await parseTrainingWorkbook(Buffer.from("libro-ficticio"));
    expect(parsed.people).toHaveLength(1);
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0]).toMatchObject({ durationHours: 1.5, isGmp: true });
    expect(parsed.attendances).toHaveLength(1);
    expect(parsed.duplicateAttendanceRows).toBe(1);
    expect(parsed.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rechaza una asistencia que apunta a una sesión inexistente", async () => {
    workbook.attendances[1][0] = "SES-AUSENTE";
    const { parseTrainingWorkbook } = await import("./training-import-parser");
    await expect(parseTrainingWorkbook(Buffer.from("libro-ficticio"))).rejects.toThrow("sesión inexistente");
    workbook.attendances[1][0] = "SES-DEMO-1";
  });
});

describe("splitMultiValue", () => {
  it("consolida varios formadores sin elegir uno arbitrariamente", async () => {
    const { splitMultiValue } = await import("./training-import-parser");
    expect(splitMultiValue("Formador A; Formador B / Formador A\nFormador C")).toEqual(["Formador A", "Formador B", "Formador C"]);
  });
});

describe("isoDate", () => {
  it("solo acepta fechas exactas y válidas", async () => {
    const { isoDate } = await import("./training-import-parser");
    expect(isoDate(new Date("2026-06-15T00:00:00.000Z"))).toBe("2026-06-15");
    expect(isoDate("2026-02-30")).toBeUndefined();
    expect(isoDate("Segundo trimestre")).toBeUndefined();
  });
});

