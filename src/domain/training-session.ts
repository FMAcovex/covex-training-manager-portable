import { z } from "zod";

const optionalText = z.string().trim().optional().transform((value) => value || undefined);
const dateText = z.string({ required_error: "La fecha es obligatoria" }).trim().min(1, "La fecha es obligatoria").refine(
  (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + "T00:00:00.000Z");
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  },
  "La fecha no es válida",
);
const uniqueIds = z.array(z.string().trim().min(1)).default([]).superRefine((ids, context) => {
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "No se puede duplicar un valor" });
});
const uniqueNames = z.array(z.string().trim().min(1)).default([]).superRefine((names, context) => {
  const normalized = names.map((name) => name.toLocaleLowerCase("es"));
  if (new Set(normalized).size !== normalized.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "No se puede duplicar un formador" });
});
const unique = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))];

export const executionStatusSchema = z.enum(["PENDING", "EXECUTED", "NOT_EXECUTED"]);
export const attendanceStatusSchema = z.enum(["EXPECTED", "ATTENDED", "NOT_ATTENDED"]);
export const attendanceResultSchema = z.enum(["PENDING", "PASS", "FAIL", "NOT_APPLICABLE"]);

export const sessionInputSchema = z.object({
  trainingId: z.string().trim().min(1, "La formación es obligatoria"),
  plannedDate: dateText,
  trainerPersonIds: uniqueIds,
  externalTrainerNames: uniqueNames,
  trainerPersonId: optionalText,
  externalTrainerName: optionalText,
  durationMinutes: z.coerce.number({ invalid_type_error: "La duración debe ser un número entero" })
    .int("La duración debe ser un número entero")
    .positive("La duración debe ser positiva"),
  blankAttendanceRows: z.coerce.number({ invalid_type_error: "Las filas en blanco deben ser un número entero" })
    .int("Las filas en blanco deben ser un número entero")
    .min(0, "Las filas en blanco no pueden ser negativas")
    .default(0),
  notes: optionalText,
  attendeePersonIds: uniqueIds,
}).strict().transform((session) => {
  const trainerPersonIds = unique([...session.trainerPersonIds, session.trainerPersonId]);
  const externalTrainerNames = unique([...session.externalTrainerNames, session.externalTrainerName]);
  return {
    ...session,
    trainerPersonIds,
    externalTrainerNames,
    trainerPersonId: trainerPersonIds[0],
    externalTrainerName: externalTrainerNames[0],
  };
});

export const attendanceCompletionSchema = z.object({
  personId: z.string().trim().min(1),
  attendanceStatus: z.enum(["ATTENDED", "NOT_ATTENDED"]),
  result: z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]),
  notes: optionalText,
}).superRefine((item, context) => {
  if (item.attendanceStatus === "NOT_ATTENDED" && item.result !== "NOT_APPLICABLE") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["result"], message: "Una persona que no asiste debe tener resultado no aplicable" });
  }
  if (item.attendanceStatus === "ATTENDED" && item.result === "NOT_APPLICABLE") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["result"], message: "Una persona que asiste debe tener resultado apto o no apto" });
  }
});

export const finalizeSessionSchema = z.object({
  executionDate: dateText,
  initializeDefaults: z.boolean().default(true),
  attendances: z.array(attendanceCompletionSchema).superRefine((items, context) => {
    const ids = items.map((item) => item.personId);
    if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "No se puede duplicar un asistente" });
  }).default([]),
});

export const notExecutedSchema = z.object({
  reason: z.string().trim().min(1, "El motivo de no ejecución es obligatorio"),
});

export type SessionExecutionStatus = z.infer<typeof executionStatusSchema>;
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;
export type AttendanceResult = z.infer<typeof attendanceResultSchema>;
type ParsedSessionInput = z.infer<typeof sessionInputSchema>;
export type SessionInput = Omit<ParsedSessionInput, "trainerPersonIds" | "externalTrainerNames" | "trainerPersonId" | "externalTrainerName" | "blankAttendanceRows"> & {
  trainerPersonIds?: string[];
  blankAttendanceRows?: number;
  externalTrainerNames?: string[];
  trainerPersonId?: string;
  externalTrainerName?: string;
};
export type AttendanceCompletion = z.infer<typeof attendanceCompletionSchema>;
export type FinalizeSessionInput = z.infer<typeof finalizeSessionSchema>;
export type NotExecutedInput = z.infer<typeof notExecutedSchema>;

export type Attendance = {
  id: string;
  sessionId: string;
  personId: string;
  attendanceStatus: AttendanceStatus;
  result: AttendanceResult;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type TrainingSession = Omit<SessionInput, "attendeePersonIds"> & {
  id: string;
  code: string;
  executionDate?: string;
  executionStatus: SessionExecutionStatus;
  nonExecutionReason?: string;
  createdAt: string;
  updatedAt: string;
  executedAt?: string;
  executedByUserId?: string;
  attendances: Attendance[];
};

export type TrainingGlobalStatus = SessionExecutionStatus;

export function validateSessionInput(input: unknown): SessionInput { return sessionInputSchema.parse(input); }
export function validateFinalizeSession(input: unknown): FinalizeSessionInput { return finalizeSessionSchema.parse(input); }
export function validateNotExecuted(input: unknown): NotExecutedInput { return notExecutedSchema.parse(input); }
export function validateAttendanceCompletion(input: unknown): AttendanceCompletion { return attendanceCompletionSchema.parse(input); }

export function formatSessionCode(trainingCode: string, sequence: number): string {
  if (!/^FOR-\d{4}-\d{4}$/.test(trainingCode)) throw new Error("El código de formación no es válido");
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99) throw new Error("La secuencia de sesión debe estar entre 1 y 99");
  return trainingCode + "-S" + String(sequence).padStart(2, "0");
}

export function highestSessionSequence(trainingCode: string, sessionCodes: string[]): number {
  const escaped = trainingCode.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp("^" + escaped + "-S(\\d{2})$");
  return sessionCodes.reduce((maximum, code) => {
    const match = pattern.exec(code);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
}

export function calculateTrainingStatus(sessions: Array<Pick<TrainingSession, "executionStatus">>): TrainingGlobalStatus {
  if (sessions.length === 0 || sessions.some((session) => session.executionStatus === "PENDING")) return "PENDING";
  if (sessions.every((session) => session.executionStatus === "EXECUTED")) return "EXECUTED";
  return "NOT_EXECUTED";
}
