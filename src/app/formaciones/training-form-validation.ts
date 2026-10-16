import type { ZodIssue } from "zod";

export const trainingFormFields = [
  "year", "name", "planningType", "trainingTypeId", "reason", "isGmp", "originType", "modalityId",
  "plannedDurationMinutes", "materialReference", "content", "targetGroup", "targetDepartmentIds",
  "plannedTrainerPersonIds", "externalTrainerNames", "plannedTrainerPersonId", "externalTrainerName",
  "evaluationMethodId", "aptitudeCriterion", "frequencyMonths", "notes",
] as const;

export type TrainingFormField = typeof trainingFormFields[number];
export type TrainingFormErrors = Partial<Record<TrainingFormField, string>>;

const knownFields = new Set<string>(trainingFormFields);

export function collectTrainingFormErrors(issues: ZodIssue[]) {
  const fields: TrainingFormErrors = {};
  let firstField: TrainingFormField | undefined;
  for (const issue of issues) {
    const candidate = issue.path[0];
    if (typeof candidate !== "string" || !knownFields.has(candidate)) continue;
    const field = candidate as TrainingFormField;
    if (!fields[field]) fields[field] = issue.message;
    firstField ??= field;
  }
  return { fields, firstField };
}
