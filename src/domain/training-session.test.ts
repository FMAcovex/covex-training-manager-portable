import { describe, expect, it } from "vitest";
import { calculateTrainingStatus, formatSessionCode, highestSessionSequence, validateAttendanceCompletion, validateFinalizeSession, validateNotExecuted, validateSessionInput } from "./training-session";

const valid = { trainingId: "training-1", plannedDate: "2026-04-15", trainerPersonId: "person-1", durationMinutes: 60, attendeePersonIds: ["person-1"] };

describe("validación de Sesión", () => {
  it("acepta una sesión válida", () => expect(validateSessionInput(valid)).toMatchObject(valid));
  it("rechaza una fecha prevista inexistente", () => expect(() => validateSessionInput({ ...valid, plannedDate: "2026-02-30" })).toThrow("fecha"));
  it("rechaza una duración no positiva", () => expect(() => validateSessionInput({ ...valid, durationMinutes: 0 })).toThrow("positiva"));
  it("muestra un mensaje legible si la duración no es numérica", () => expect(() => validateSessionInput({ ...valid, durationMinutes: "abc" })).toThrow("número entero"));
  it("rechaza asistentes duplicados", () => expect(() => validateSessionInput({ ...valid, attendeePersonIds: ["person-1", "person-1"] })).toThrow("duplicar"));
  it("acepta cero o más filas en blanco para el Anexo III", () => expect(validateSessionInput({ ...valid, blankAttendanceRows: 4 }).blankAttendanceRows).toBe(4));
  it("rechaza un número negativo de filas en blanco", () => expect(() => validateSessionInput({ ...valid, blankAttendanceRows: -1 })).toThrow("negativas"));
  it("rechaza intentos de enviar el código", () => expect(() => validateSessionInput({ ...valid, code: "FOR-2026-0001-S99" })).toThrow());
  it("exige fecha de ejecución al finalizar", () => expect(() => validateFinalizeSession({ initializeDefaults: true, attendances: [] })).toThrow("fecha"));
  it("exige motivo al marcar no ejecutada", () => expect(() => validateNotExecuted({ reason: " " })).toThrow("motivo"));
});

describe("coherencia de asistencia y resultado", () => {
  it("acepta ASISTE + APTO", () => expect(validateAttendanceCompletion({ personId: "p1", attendanceStatus: "ATTENDED", result: "PASS" }).result).toBe("PASS"));
  it("acepta ASISTE + NO_APTO y conserva observaciones", () => expect(validateAttendanceCompletion({ personId: "p1", attendanceStatus: "ATTENDED", result: "FAIL", notes: "Refuerzo ficticio" }).notes).toBe("Refuerzo ficticio"));
  it("acepta NO_ASISTE + NO_APLICABLE", () => expect(validateAttendanceCompletion({ personId: "p1", attendanceStatus: "NOT_ATTENDED", result: "NOT_APPLICABLE" }).result).toBe("NOT_APPLICABLE"));
  it("rechaza NO_ASISTE + APTO", () => expect(() => validateAttendanceCompletion({ personId: "p1", attendanceStatus: "NOT_ATTENDED", result: "PASS" })).toThrow("no aplicable"));
  it("rechaza NO_ASISTE + NO_APTO", () => expect(() => validateAttendanceCompletion({ personId: "p1", attendanceStatus: "NOT_ATTENDED", result: "FAIL" })).toThrow("no aplicable"));
});

describe("código y estado global", () => {
  it("genera el formato de código de sesión", () => expect(formatSessionCode("FOR-2026-0001", 2)).toBe("FOR-2026-0001-S02"));
  it("obtiene el mayor sufijo emitido sin mezclar formaciones", () => expect(highestSessionSequence("FOR-2026-0001", ["FOR-2026-0001-S01", "FOR-2026-0002-S09", "FOR-2026-0001-S03"])).toBe(3));
  it.each([
    [[], "PENDING"],
    [["PENDING"], "PENDING"],
    [["EXECUTED", "PENDING"], "PENDING"],
    [["EXECUTED", "EXECUTED"], "EXECUTED"],
    [["EXECUTED", "NOT_EXECUTED"], "NOT_EXECUTED"],
  ] as const)("calcula el estado global %#", (statuses, expected) => expect(calculateTrainingStatus(statuses.map((executionStatus) => ({ executionStatus })))).toBe(expected));
});
