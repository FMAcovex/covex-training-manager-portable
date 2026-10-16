import { describe, expect, it } from "vitest";
import { validatePerson } from "./person";

const base = { fullName: "Persona Ficticia", personType: "INTERNAL" as const, departmentId: "quality", jobTitle: "Técnico/a" };

describe("validación de Personal", () => {
  it("acepta personal interno sin empresa", () => expect(validatePerson(base).personType).toBe("INTERNAL"));
  it("rechaza personal interno sin departamento", () => expect(() => validatePerson({ ...base, departmentId: "" })).toThrow("departamento"));
  it("exige empresa para personal externo", () => expect(() => validatePerson({ ...base, personType: "EXTERNAL", departmentId: undefined })).toThrow("empresa"));
  it("normaliza opcionales vacíos antes de persistir", () => expect(validatePerson({ ...base, employeeCode: "", company: "", notes: "" })).toMatchObject({ employeeCode: undefined, company: undefined, notes: undefined }));
  it("exige nombre y puesto", () => expect(() => validatePerson({ ...base, fullName: "" })).toThrow());
});
