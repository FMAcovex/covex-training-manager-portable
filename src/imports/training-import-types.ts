import { z } from "zod";
import type { CatalogItem } from "@/domain/training-catalogs";
import type { Department } from "@/domain/department";

export const personTargetSchema = z.string().regex(/^(source|existing):.+$/, "La persona seleccionada no es válida");
const mappingRecord = z.record(z.string(), z.string().trim().min(1));

export const trainingImportMappingsSchema = z.object({
  trainingTypes: mappingRecord.default({}),
  modalities: mappingRecord.default({}),
  departments: mappingRecord.default({}),
  trainingDepartments: z.record(z.string(), z.array(z.string().trim().min(1))).default({}),
  sourcePeople: z.record(z.string(), personTargetSchema).default({}),
  trainers: z.record(z.string(), personTargetSchema).default({}),
  attendees: z.record(z.string(), personTargetSchema).default({}),
  dateOverrides: z.record(z.string(), z.object({
    plannedDate: z.string().optional(),
    executionDate: z.string().optional(),
  })).default({}),
  attendanceResults: z.record(z.string(), z.enum(["PASS", "FAIL", "NOT_APPLICABLE"])).default({}),
}).strict();

export type TrainingImportMappings = z.infer<typeof trainingImportMappingsSchema>;
export type ImportIssue = {
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
  field?: "trainingType" | "modality" | "department" | "trainingDepartment" | "sourcePerson" | "trainer" | "attendee" | "date" | "attendanceResult" | "duplicate";
  key?: string;
};

export type ImportPersonOption = {
  key: string;
  label: string;
  personType: "INTERNAL" | "EXTERNAL";
  active: boolean;
};

export type TrainingImportPreview = {
  fingerprint: string;
  fileName: string;
  counts: {
    sourcePeople: number;
    peopleToCreate: number;
    peopleToReuse: number;
    trainings: number;
    sessions: number;
    attendances: number;
    executedSessions: number;
  };
  sourceValues: {
    trainingTypes: string[];
    modalities: string[];
    departments: string[];
    trainingDepartments: Array<{ key: string; label: string; sourceDepartments: string[] }>;
    sourcePeople: Array<{ key: string; label: string; suggestedTarget: string }>;
    trainers: string[];
    unresolvedAttendees: string[];
    ambiguousDates: Array<{ sessionId: string; field: "plannedDate" | "executionDate"; rawValue: string }>;
    invalidAttendanceResults: Array<{ key: string; sessionId: string; attendee: string; rawValue: string }>;
  };
  options: {
    trainingTypes: CatalogItem[];
    modalities: CatalogItem[];
    departments: Department[];
    people: ImportPersonOption[];
  };
  suggestedMappings: TrainingImportMappings;
  issues: ImportIssue[];
  canCommit: boolean;
};

export type TrainingImportResult = {
  importId: string;
  fingerprint: string;
  counts: TrainingImportPreview["counts"];
};

