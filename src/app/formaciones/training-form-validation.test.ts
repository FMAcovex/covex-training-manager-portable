import { describe, expect, it } from "vitest";
import { trainingCreateInputSchema } from "@/domain/training";
import { collectTrainingFormErrors } from "./training-form-validation";

describe("collectTrainingFormErrors", () => {
  it("asocia todos los errores de alta con su campo y conserva el primero", () => {
    const parsed = trainingCreateInputSchema.safeParse({
      year: "2026", name: "", planningType: "UNPLANNED", trainingTypeId: "", reason: "", isGmp: false,
      originType: "INTERNAL", modalityId: "", plannedDurationMinutes: "", materialReference: "", content: "",
      targetGroup: "", plannedTrainerPersonId: "", externalTrainerName: "", evaluationMethodId: "",
      aptitudeCriterion: "", frequencyMonths: "", notes: "",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const result = collectTrainingFormErrors(parsed.error.issues);
    expect(result.firstField).toBe("name");
    expect(result.fields.name).toBe("El nombre del curso es obligatorio");
    expect(result.fields.reason).toBe("El motivo es obligatorio para una formación no planificada");
    expect(result.fields.plannedTrainerPersonIds).toBe("Debe seleccionar al menos un formador cualificado");
    expect(result.fields.frequencyMonths).toBeUndefined();
    expect(result.fields.notes).toBeUndefined();
  });
});
