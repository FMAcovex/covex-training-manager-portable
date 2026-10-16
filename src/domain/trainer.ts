import { z } from "zod";
import type { Person } from "@/domain/person";

const dateText = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato AAAA-MM-DD").refine((value) => {
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "La fecha no es válida");

const optionalDateText = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  dateText.optional(),
);

export const trainerQualificationInputSchema = z.object({
  personId: z.string().trim().min(1, "El formador es obligatorio"),
  authorizedSubject: z.string().trim().min(1, "La materia o formación autorizada es obligatoria"),
  evidence: z.string().trim().min(1, "La evidencia de cualificación es obligatoria"),
  qualifiedFrom: dateText,
  qualifiedTo: optionalDateText,
}).superRefine((value, context) => {
  if (value.qualifiedTo && value.qualifiedTo < value.qualifiedFrom) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["qualifiedTo"], message: "La fecha de baja no puede ser anterior a la fecha de alta" });
  }
});

export type TrainerQualificationInput = z.infer<typeof trainerQualificationInputSchema>;

export type TrainerPerson = Pick<Person, "id" | "fullName" | "personType" | "company" | "departmentId" | "jobTitle" | "active">;

export type TrainerQualification = TrainerQualificationInput & {
  id: string;
  person: TrainerPerson;
  createdAt: string;
  updatedAt: string;
  current: boolean;
  annulledAt?: string;
  annulledByUserId?: string;
  annulmentReason?: string;
};

export type TrainerDocumentMeta = {
  id: string;
  personId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  createdAt: string;
};

export type TrainerDocumentContent = TrainerDocumentMeta & { content: Buffer };

export type TrainerDocumentInput = {
  fileName: string;
  mimeType: string;
  content: Buffer;
};

export const trainerQualificationRetireSchema = z.object({
  qualifiedTo: dateText,
}).strict();

export const trainerQualificationAnnulSchema = z.object({
  reason: z.string().trim().min(3, "El motivo de anulación debe tener al menos 3 caracteres"),
}).strict();

export type TrainerQualificationRetireInput = z.infer<typeof trainerQualificationRetireSchema>;
export type TrainerQualificationAnnulInput = z.infer<typeof trainerQualificationAnnulSchema>;

export function qualificationIsCurrent(
  value: Pick<TrainerQualificationInput, "qualifiedFrom" | "qualifiedTo"> & { annulledAt?: string },
  today = new Date().toISOString().slice(0, 10),
) {
  return !value.annulledAt && value.qualifiedFrom <= today && (!value.qualifiedTo || value.qualifiedTo > today);
}

export function normalizeTrainerSubject(value: string) {
  return value.trim().toLocaleLowerCase("es");
}

export function validateTrainerQualification(input: unknown): TrainerQualificationInput {
  return trainerQualificationInputSchema.parse(input);
}
