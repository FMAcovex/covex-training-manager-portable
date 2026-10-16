import { z } from "zod";

const optionalText = z.string().trim().optional().transform((value) => value || undefined);
const optionalPositiveInteger = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number({ invalid_type_error: "Debe ser un número entero" })
    .int("Debe ser un número entero")
    .positive("Debe ser un valor positivo")
    .optional(),
);
const uniqueIds = z.array(z.string().trim().min(1)).default([]).superRefine((ids, context) => {
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "No se puede duplicar un valor" });
});
const uniqueNames = z.array(z.string().trim().min(1)).default([]).superRefine((names, context) => {
  const normalized = names.map((name) => name.toLocaleLowerCase("es"));
  if (new Set(normalized).size !== normalized.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "No se puede duplicar un formador" });
});
const unique = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))];

export const planningTypeSchema = z.enum(["PLANNED", "UNPLANNED"]);
export const trainingOriginTypeSchema = z.enum(["INTERNAL", "EXTERNAL"]);

const trainingFieldsSchema = z.object({
  year: z.coerce.number({ invalid_type_error: "El año debe ser un número entero" })
    .int("El año debe ser un número entero")
    .min(1000, "El año debe tener cuatro cifras")
    .max(9999, "El año debe tener cuatro cifras"),
  name: z.string().trim().min(1, "El nombre del curso es obligatorio"),
  planningType: planningTypeSchema,
  trainingTypeId: optionalText,
  reason: optionalText,
  isGmp: z.boolean(),
  originType: trainingOriginTypeSchema,
  modalityId: optionalText,
  plannedDurationMinutes: optionalPositiveInteger,
  materialReference: optionalText,
  content: optionalText,
  targetGroup: optionalText,
  targetDepartmentIds: uniqueIds,
  plannedTrainerPersonIds: uniqueIds,
  externalTrainerNames: uniqueNames,
  plannedTrainerPersonId: optionalText,
  externalTrainerName: optionalText,
  evaluationMethodId: optionalText,
  aptitudeCriterion: optionalText,
  frequencyMonths: optionalPositiveInteger,
  notes: optionalText,
});

type RawTrainingInput = z.infer<typeof trainingFieldsSchema>;

const effectiveTrainerIds = (training: RawTrainingInput) => unique([...training.plannedTrainerPersonIds, training.plannedTrainerPersonId]);
const effectiveExternalTrainerNames = (training: RawTrainingInput) => unique([...training.externalTrainerNames, training.externalTrainerName]);

function addTrainingRules(training: RawTrainingInput, context: z.RefinementCtx, requireComplete: boolean) {
  if (training.planningType === "UNPLANNED" && !training.reason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "El motivo es obligatorio para una formación no planificada" });
  }

  if (!requireComplete) return;

  const requiredTextFields: Array<[keyof RawTrainingInput, string]> = [
    ["trainingTypeId", "El tipo de formación es obligatorio"],
    ["modalityId", "La modalidad es obligatoria"],
    ["materialReference", "El material o documento de referencia es obligatorio"],
    ["content", "El contenido es obligatorio"],
    ["targetGroup", "El colectivo objetivo es obligatorio"],
    ["evaluationMethodId", "El método de evaluación es obligatorio"],
    ["aptitudeCriterion", "El criterio de aptitud es obligatorio"],
  ];

  for (const [field, message] of requiredTextFields) {
    if (!training[field]) context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
  }
  if (!training.plannedDurationMinutes) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["plannedDurationMinutes"], message: "La duración prevista es obligatoria" });
  }
  const trainerIds = effectiveTrainerIds(training);
  const externalNames = effectiveExternalTrainerNames(training);
  if (training.originType === "INTERNAL" && trainerIds.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["plannedTrainerPersonIds"], message: "Debe seleccionar al menos un formador cualificado" });
  }
  if (training.originType === "EXTERNAL" && trainerIds.length === 0 && externalNames.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["externalTrainerNames"], message: "Selecciona un formador externo cualificado o indica manualmente el formador, entidad u organismo" });
  }
}

function buildTrainingSchema(requireComplete: boolean) {
  return trainingFieldsSchema
    .superRefine((training, context) => addTrainingRules(training, context, requireComplete))
    .transform((training) => {
      const plannedTrainerPersonIds = effectiveTrainerIds(training);
      const externalTrainerNames = training.originType === "EXTERNAL" ? effectiveExternalTrainerNames(training) : [];
      return {
        ...training,
        targetDepartmentIds: unique(training.targetDepartmentIds),
        plannedTrainerPersonIds,
        externalTrainerNames,
        plannedTrainerPersonId: plannedTrainerPersonIds[0],
        externalTrainerName: externalTrainerNames[0],
      };
    });
}

export const trainingInputSchema = buildTrainingSchema(false);
export const trainingCreateInputSchema = buildTrainingSchema(true);

export type PlanningType = z.infer<typeof planningTypeSchema>;
export type TrainingOriginType = z.infer<typeof trainingOriginTypeSchema>;
type ParsedTrainingInput = z.infer<typeof trainingInputSchema>;
export type TrainingInput = Omit<ParsedTrainingInput, "targetDepartmentIds" | "plannedTrainerPersonIds" | "externalTrainerNames" | "plannedTrainerPersonId" | "externalTrainerName"> & {
  targetDepartmentIds?: string[];
  plannedTrainerPersonIds?: string[];
  externalTrainerNames?: string[];
  plannedTrainerPersonId?: string;
  externalTrainerName?: string;
};
export type Training = TrainingInput & {
  id: string;
  code: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  globalStatus?: "PENDING" | "EXECUTED" | "NOT_EXECUTED";
  closedAt?: string;
  closedByUserId?: string;
};

export type TrainingFilters = Partial<Pick<TrainingInput, "year" | "planningType" | "isGmp" | "trainingTypeId" | "originType">> & {
  search?: string;
  departmentId?: string;
  trainerPersonId?: string;
  externalTrainerName?: string;
  trainer?: string;
};

export function validateTraining(input: unknown): TrainingInput {
  return trainingInputSchema.parse(input);
}

export function validateNewTraining(input: unknown): TrainingInput {
  return trainingCreateInputSchema.parse(input);
}

export function formatTrainingCode(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new Error("El año debe tener cuatro cifras");
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) throw new Error("La secuencia debe estar entre 1 y 9999");
  return "FOR-" + year + "-" + String(sequence).padStart(4, "0");
}

export function matchesTrainingFilters(training: Training, filters: TrainingFilters): boolean {
  const search = filters.search?.trim().toLocaleLowerCase("es");
  const trainer = filters.trainer?.trim().toLocaleLowerCase("es");
  const externalTrainerNames = training.externalTrainerNames ?? (training.externalTrainerName ? [training.externalTrainerName] : []);
  const plannedTrainerPersonIds = training.plannedTrainerPersonIds ?? (training.plannedTrainerPersonId ? [training.plannedTrainerPersonId] : []);
  const targetDepartmentIds = training.targetDepartmentIds ?? [];
  return (!filters.year || training.year === filters.year)
    && (!search || training.name.toLocaleLowerCase("es").includes(search) || training.code.toLocaleLowerCase("es").includes(search))
    && (!filters.planningType || training.planningType === filters.planningType)
    && (filters.isGmp === undefined || training.isGmp === filters.isGmp)
    && (!filters.trainingTypeId || training.trainingTypeId === filters.trainingTypeId)
    && (!filters.originType || training.originType === filters.originType)
    && (!filters.departmentId || targetDepartmentIds.includes(filters.departmentId))
    && (!filters.trainerPersonId || plannedTrainerPersonIds.includes(filters.trainerPersonId))
    && (!filters.externalTrainerName || externalTrainerNames.includes(filters.externalTrainerName))
    && (!trainer || externalTrainerNames.some((name) => name.toLocaleLowerCase("es").includes(trainer)));
}
