import type { CurrentUser } from "@/auth/current-user";
import type { TrainerQualificationInput } from "@/domain/trainer";
import { normalizeTrainerName, parseTrainerQualificationDocx } from "@/imports/trainer-import-parser";
import type { TrainerImportIssue, TrainerImportMappings, TrainerImportPreview, TrainerImportResult } from "@/imports/trainer-import-types";
import type { PeopleRepository } from "@/server/people-repository";
import type { TrainerRepository } from "@/server/trainer-repository";

const key = (personId: string, subject: string, qualifiedFrom: string) =>
  [personId, subject.trim().toLocaleLowerCase("es"), qualifiedFrom].join("|");

export class TrainerImportValidationError extends Error {
  constructor(message: string, readonly preview: TrainerImportPreview) { super(message); }
}

export async function previewTrainerImport(
  buffer: Buffer,
  mappings: TrainerImportMappings,
  peopleRepository: PeopleRepository,
  trainerRepository: TrainerRepository,
): Promise<TrainerImportPreview> {
  const rows = parseTrainerQualificationDocx(buffer);
  const [people, existing] = await Promise.all([peopleRepository.list(), trainerRepository.list()]);
  const activePeople = people.filter((person) => person.active);
  const grouped = new Map<string, { key: string; name: string; personType: "INTERNAL" | "EXTERNAL" }>();
  for (const row of rows) {
    const sourceKey = `${row.personType}:${normalizeTrainerName(row.trainerName)}`;
    if (!grouped.has(sourceKey)) grouped.set(sourceKey, { key: sourceKey, name: row.trainerName, personType: row.personType });
  }
  const suggestedMappings = { ...mappings };
  const issues: TrainerImportIssue[] = [];
  for (const source of grouped.values()) {
    if (suggestedMappings[source.key]) continue;
    const matches = activePeople.filter((person) => person.personType === source.personType && normalizeTrainerName(person.fullName) === normalizeTrainerName(source.name));
    if (matches.length === 1) suggestedMappings[source.key] = matches[0].id;
  }

  const existingKeys = new Set(existing.map((item) => key(item.personId, item.authorizedSubject, item.qualifiedFrom)));
  let alreadyRegistered = 0;
  const prospectiveKeys = new Set<string>();
  for (const row of rows) {
    const sourceKey = `${row.personType}:${normalizeTrainerName(row.trainerName)}`;
    const personId = suggestedMappings[sourceKey];
    if (!personId) {
      issues.push({ severity: "ERROR", code: "PERSON_MAPPING_REQUIRED", message: `Asigna “${row.trainerName}” a una persona existente del tipo ${row.personType === "INTERNAL" ? "interno" : "externo"}.` });
      continue;
    }
    const person = activePeople.find((candidate) => candidate.id === personId);
    if (!person) {
      issues.push({ severity: "ERROR", code: "PERSON_NOT_AVAILABLE", message: `La persona asignada a “${row.trainerName}” no existe o está inactiva.` });
      continue;
    }
    if (person.personType !== row.personType) {
      issues.push({ severity: "ERROR", code: "PERSON_TYPE_MISMATCH", message: `“${row.trainerName}” figura como ${row.personType === "INTERNAL" ? "INTERNO" : "EXTERNO"}, pero la persona elegida tiene otro tipo.` });
      continue;
    }
    const rowKey = key(personId, row.authorizedSubject, row.qualifiedFrom);
    if (existingKeys.has(rowKey)) { alreadyRegistered++; continue; }
    if (prospectiveKeys.has(rowKey)) issues.push({ severity: "ERROR", code: "DUPLICATE_ROW", message: `La cualificación de ${row.trainerName} para “${row.authorizedSubject}” está duplicada en el documento.` });
    prospectiveKeys.add(rowKey);
  }
  if (alreadyRegistered) issues.push({ severity: "WARNING", code: "ALREADY_REGISTERED", message: `${alreadyRegistered} línea(s) ya existen y se omitirán al confirmar.` });

  const uniqueIssues = [...new Map(issues.map((issue) => [`${issue.code}|${issue.message}`, issue])).values()];
  return {
    rows,
    sourceTrainers: [...grouped.values()],
    people: activePeople.map(({ id, fullName, personType, company, jobTitle, active }) => ({ id, fullName, personType, company, jobTitle, active })),
    suggestedMappings,
    issues: uniqueIssues,
    canCommit: !uniqueIssues.some((issue) => issue.severity === "ERROR"),
    counts: { rows: rows.length, trainers: grouped.size, newQualifications: prospectiveKeys.size, alreadyRegistered },
  };
}

export async function commitTrainerImport(
  buffer: Buffer,
  mappings: TrainerImportMappings,
  actor: CurrentUser,
  peopleRepository: PeopleRepository,
  trainerRepository: TrainerRepository,
): Promise<TrainerImportResult> {
  const preview = await previewTrainerImport(buffer, mappings, peopleRepository, trainerRepository);
  if (!preview.canCommit) throw new TrainerImportValidationError("La importación requiere resolver los errores indicados", preview);
  const existing = await trainerRepository.list();
  const existingKeys = new Set(existing.map((item) => key(item.personId, item.authorizedSubject, item.qualifiedFrom)));
  const inputs: TrainerQualificationInput[] = preview.rows.flatMap((row) => {
    const sourceKey = `${row.personType}:${normalizeTrainerName(row.trainerName)}`;
    const personId = preview.suggestedMappings[sourceKey];
    const rowKey = key(personId, row.authorizedSubject, row.qualifiedFrom);
    if (existingKeys.has(rowKey)) return [];
    return [{
      personId,
      authorizedSubject: row.authorizedSubject,
      evidence: row.evidence,
      qualifiedFrom: row.qualifiedFrom,
      qualifiedTo: row.qualifiedTo,
    }];
  });
  if (inputs.length) await trainerRepository.importQualifications(inputs, actor.id);
  return { imported: inputs.length, skippedExisting: preview.counts.alreadyRegistered };
}
