import { describe, expect, it } from "vitest";
import { formatTrainingCode, validateNewTraining, validateTraining } from "./training";

const base = { year: 2026, name: "Formación ficticia", planningType: "PLANNED" as const, isGmp: false, originType: "INTERNAL" as const };

describe("validación de Formación", () => {
  it("acepta una formación válida sin exigir evaluación antes de crear sesiones", () => expect(validateTraining(base)).toMatchObject(base));
  it("rechaza una no planificada sin motivo", () => expect(() => validateTraining({ ...base, planningType: "UNPLANNED", reason: "" })).toThrow("motivo"));
  it("acepta una no planificada con motivo", () => expect(validateTraining({ ...base, planningType: "UNPLANNED", reason: "Necesidad ficticia" }).reason).toBe("Necesidad ficticia"));
  it("acepta una planificada sin motivo", () => expect(validateTraining({ ...base, reason: "" }).reason).toBeUndefined());
  it("normaliza los textos opcionales vacíos", () => expect(validateTraining({ ...base, trainingTypeId: " ", content: "", targetGroup: "", notes: "" })).toMatchObject({ trainingTypeId: undefined, content: undefined, targetGroup: undefined, notes: undefined }));
  it("conserva personas formadoras externas y referencias históricas por nombre", () => expect(validateTraining({ ...base, originType: "EXTERNAL", plannedTrainerPersonId: "persona-demo", externalTrainerName: "Docente demo" })).toMatchObject({ plannedTrainerPersonId: "persona-demo", externalTrainerName: "Docente demo" }));
  it("rechaza una duración inválida", () => expect(() => validateTraining({ ...base, plannedDurationMinutes: 0 })).toThrow("positivo"));
  it("rechaza una frecuencia inválida", () => expect(() => validateTraining({ ...base, frequencyMonths: -1 })).toThrow("positivo"));
  it("muestra un mensaje legible si la duración no es numérica", () => expect(() => validateTraining({ ...base, plannedDurationMinutes: "abc" })).toThrow("número entero"));
  it("muestra un mensaje legible si el año no es numérico", () => expect(() => validateTraining({ ...base, year: "abc" })).toThrow("año debe ser un número entero"));
});


const completeNewTraining = {
  year: 2026,
  name: "Formación ficticia completa",
  planningType: "UNPLANNED" as const,
  trainingTypeId: "type-demo",
  reason: "Necesidad ficticia",
  isGmp: true,
  originType: "INTERNAL" as const,
  modalityId: "modality-demo",
  plannedDurationMinutes: 60,
  materialReference: "Documento ficticio",
  content: "Contenido ficticio",
  targetGroup: "Colectivo ficticio",
  plannedTrainerPersonId: "person-demo",
  externalTrainerName: "",
  evaluationMethodId: "evaluation-demo",
  aptitudeCriterion: "Criterio ficticio",
  frequencyMonths: 12,
  notes: "Observaciones ficticias",
};

describe("validación del alta de Formación", () => {
  it("acepta un alta con todos los campos aplicables cumplimentados", () => expect(validateNewTraining(completeNewTraining)).toMatchObject({ name: completeNewTraining.name, planningType: "UNPLANNED" }));
  it("mantiene el motivo opcional para una formación planificada", () => expect(validateNewTraining({ ...completeNewTraining, planningType: "PLANNED", reason: "" }).reason).toBeUndefined());
  it.each([
    "trainingTypeId",
    "modalityId",
    "plannedDurationMinutes",
    "materialReference",
    "content",
    "targetGroup",
    "evaluationMethodId",
    "aptitudeCriterion",
  ] as const)("rechaza un alta sin el campo obligatorio %s", (field) => {
    expect(() => validateNewTraining({ ...completeNewTraining, [field]: "" })).toThrow("obligatori");
  });
  it("acepta frecuencia y observaciones vacías en el alta", () => expect(validateNewTraining({ ...completeNewTraining, frequencyMonths: "", notes: "" })).toMatchObject({ frequencyMonths: undefined, notes: undefined }));
  it("exige un formador cualificado cuando el origen es interno", () => expect(() => validateNewTraining({ ...completeNewTraining, plannedTrainerPersonId: "" })).toThrow("formador cualificado"));
  it("acepta un formador externo escrito manualmente sin exigir cualificación", () => expect(validateNewTraining({ ...completeNewTraining, originType: "EXTERNAL", plannedTrainerPersonId: "", externalTrainerName: "Organismo público ficticio" })).toMatchObject({ originType: "EXTERNAL", externalTrainerName: "Organismo público ficticio" }));
  it("acepta combinar formadores cualificados y referencias manuales en una formación externa", () => {
    expect(validateNewTraining({
      ...completeNewTraining,
      originType: "EXTERNAL",
      plannedTrainerPersonIds: ["person-demo"],
      plannedTrainerPersonId: undefined,
      externalTrainerNames: ["Organismo público ficticio"],
      externalTrainerName: undefined,
    })).toMatchObject({
      originType: "EXTERNAL",
      plannedTrainerPersonIds: ["person-demo"],
      externalTrainerNames: ["Organismo público ficticio"],
    });
  });
  it("rechaza una formación externa sin formador cualificado ni referencia manual", () => expect(() => validateNewTraining({ ...completeNewTraining, originType: "EXTERNAL", plannedTrainerPersonId: "", externalTrainerName: "" })).toThrow("formador externo cualificado"));
});

describe("código de Formación", () => {
  it("genera el formato FOR-YYYY-NNNN", () => expect(formatTrainingCode(2026, 1)).toBe("FOR-2026-0001"));
});
