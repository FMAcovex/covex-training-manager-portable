import type { Person } from "@/domain/person";
import type { SourceTrainerQualification } from "@/imports/trainer-import-parser";

export type TrainerImportMappings = Record<string, string>;

export type TrainerImportIssue = {
  severity: "ERROR" | "WARNING";
  code: string;
  message: string;
};

export type TrainerImportPreview = {
  rows: SourceTrainerQualification[];
  sourceTrainers: Array<{ key: string; name: string; personType: Person["personType"] }>;
  people: Array<Pick<Person, "id" | "fullName" | "personType" | "company" | "jobTitle" | "active">>;
  suggestedMappings: TrainerImportMappings;
  issues: TrainerImportIssue[];
  canCommit: boolean;
  counts: { rows: number; trainers: number; newQualifications: number; alreadyRegistered: number };
};

export type TrainerImportResult = { imported: number; skippedExisting: number };
