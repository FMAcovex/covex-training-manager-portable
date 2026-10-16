import type { CurrentUser } from "@/auth/current-user";
import type { Department } from "@/domain/department";
import type { Person, PersonInput } from "@/domain/person";
import { formatSessionCode, type AttendanceResult, type AttendanceStatus } from "@/domain/training-session";
import { formatTrainingCode, type TrainingInput } from "@/domain/training";
import type { CatalogItem } from "@/domain/training-catalogs";
import { getAuditEventRepository } from "@/administration/repositories";
import { shouldUsePersistentRepositories, shouldUsePortableSharePoint } from "@/config/runtime";
import { getPortableProvider } from "@/portable/sharepoint/provider";
import { prisma } from "@/server/prisma";
import { getPeopleRepository } from "@/server/people-repositories";
import { getSessionRepository } from "@/server/session-repositories";
import { getTrainingRepository } from "@/server/training-repositories";
import { isoDate, normalize, parseTrainingWorkbook, type ParsedTrainingWorkbook, type SourceAttendance, type SourcePerson, type SourceSession } from "./training-import-parser";
import { trainingImportMappingsSchema, type ImportIssue, type ImportPersonOption, type TrainingImportMappings, type TrainingImportPreview, type TrainingImportResult } from "./training-import-types";

type ImportReferences = {
  trainingTypes: CatalogItem[];
  modalities: CatalogItem[];
  departments: Department[];
  people: Person[];
  existingTrainingNames: Set<string>;
};

type ResolvedPerson = SourcePerson & { target: string };
export type ResolvedAttendance = SourceAttendance & { personTarget: string; attendanceStatus: AttendanceStatus; result: AttendanceResult };
export type ResolvedSession = SourceSession & {
  plannedDateIso: string;
  executionDateIso?: string;
  trainerTargets: string[];
  attendances: ResolvedAttendance[];
};
export type ResolvedTraining = TrainingInput & { sourceNameKey: string; sessions: ResolvedSession[] };
export type ResolvedTrainingImport = {
  fingerprint: string;
  people: ResolvedPerson[];
  trainings: ResolvedTraining[];
};

export class TrainingImportValidationError extends Error {
  constructor(public readonly preview: TrainingImportPreview) {
    super("La importación contiene incidencias que deben resolverse");
  }
}
export class TrainingImportConflictError extends Error {}

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));
const personKey = (kind: "source" | "existing", id: string) => `${kind}:${id}`;
const splitPersonKey = (key: string) => {
  const separator = key.indexOf(":");
  return { kind: key.slice(0, separator), id: key.slice(separator + 1) };
};
const mapByNormalized = <T>(items: T[], label: (item: T) => string) => {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const key = normalize(label(item));
    result.set(key, [...(result.get(key) ?? []), item]);
  }
  return result;
};
const exactCatalogSuggestion = (source: string, items: CatalogItem[]) => {
  const key = normalize(source);
  const aliases: Record<string, string[]> = {
    "online y presencial": ["mixta", "mixto", "blended"],
  };
  return items.find((item) => normalize(item.name) === key || normalize(item.code) === key || aliases[key]?.includes(normalize(item.name)))?.id ?? "";
};
const mergedMappings = (suggested: TrainingImportMappings, provided?: Partial<TrainingImportMappings>): TrainingImportMappings => trainingImportMappingsSchema.parse({
  trainingTypes: { ...suggested.trainingTypes, ...provided?.trainingTypes },
  modalities: { ...suggested.modalities, ...provided?.modalities },
  departments: { ...suggested.departments, ...provided?.departments },
  trainingDepartments: { ...suggested.trainingDepartments, ...provided?.trainingDepartments },
  sourcePeople: { ...suggested.sourcePeople, ...provided?.sourcePeople },
  trainers: { ...suggested.trainers, ...provided?.trainers },
  attendees: { ...suggested.attendees, ...provided?.attendees },
  dateOverrides: { ...suggested.dateOverrides, ...provided?.dateOverrides },
  attendanceResults: { ...suggested.attendanceResults, ...provided?.attendanceResults },
});

async function references(): Promise<ImportReferences> {
  const trainingRepository = getTrainingRepository();
  const peopleRepository = getPeopleRepository();
  const [catalogs, departments, people, trainings] = await Promise.all([
    trainingRepository.listCatalogs(),
    peopleRepository.listDepartments(),
    peopleRepository.list(),
    trainingRepository.list({ year: 2026 }),
  ]);
  return {
    ...catalogs,
    departments,
    people,
    existingTrainingNames: new Set(trainings.map((item) => normalize(item.name))),
  };
}

function suggestions(parsed: ParsedTrainingWorkbook, refs: ImportReferences): TrainingImportMappings {
  const existingByName = mapByNormalized(refs.people, (item) => item.fullName);
  const existingByEmployeeCode = new Map(refs.people.filter((item) => item.employeeCode).map((item) => [normalize(item.employeeCode!), item]));
  const sourceByName = mapByNormalized(parsed.people, (item) => item.fullName);
  const sourcePeople = Object.fromEntries(parsed.people.map((item) => {
    const byCode = existingByEmployeeCode.get(normalize(item.sourceId));
    const byName = existingByName.get(normalize(item.fullName));
    const match = byCode ?? (byName?.length === 1 ? byName[0] : undefined);
    return [item.sourceId, match ? personKey("existing", match.id) : personKey("source", item.sourceId)];
  }));
  const resolveName = (name: string) => {
    const sourceMatches = sourceByName.get(normalize(name));
    if (sourceMatches?.length === 1) return personKey("source", sourceMatches[0].sourceId);
    const existingMatches = existingByName.get(normalize(name));
    if (existingMatches?.length === 1) return personKey("existing", existingMatches[0].id);
    return "";
  };
  const sourceDepartments = unique([
    ...parsed.people.map((item) => item.department),
    ...parsed.attendances.map((item) => item.department ?? "").filter(Boolean),
  ]);
  const departmentMappings = Object.fromEntries(sourceDepartments.map((value) => [value, exactCatalogSuggestion(value, refs.departments)]).filter(([, value]) => value));
  const trainingGroups = mapByNormalized(parsed.sessions, (item) => item.trainingName);
  const sessionToTraining = new Map(parsed.sessions.map((session) => [session.sourceId, normalize(session.trainingName)]));
  const trainingDepartments = Object.fromEntries([...trainingGroups.entries()].map(([key]) => {
    const observed = unique(parsed.attendances
      .filter((item) => sessionToTraining.get(item.sessionId) === key)
      .map((item) => item.department ?? "")
      .filter(Boolean));
    return [key, unique(observed.map((name) => departmentMappings[name]).filter(Boolean))];
  }));
  const trainers = Object.fromEntries(unique(parsed.sessions
    .filter((item) => normalize(item.origin) === "interna")
    .flatMap((item) => item.trainers))
    .map((name) => [name, resolveName(name)]).filter(([, value]) => value));
  const attendees = Object.fromEntries(unique(parsed.attendances.map((item) => item.attendee)).map((name) => [name, resolveName(name)]).filter(([, value]) => value));
  return trainingImportMappingsSchema.parse({
    trainingTypes: Object.fromEntries(unique(parsed.sessions.map((item) => item.trainingType)).map((value) => [value, exactCatalogSuggestion(value, refs.trainingTypes)]).filter(([, value]) => value)),
    modalities: Object.fromEntries(unique(parsed.sessions.map((item) => item.modality)).map((value) => [value, exactCatalogSuggestion(value, refs.modalities)]).filter(([, value]) => value)),
    departments: departmentMappings,
    trainingDepartments,
    sourcePeople,
    trainers,
    attendees,
    dateOverrides: {},
    attendanceResults: {},
  });
}

function validPersonTarget(target: string | undefined, parsed: ParsedTrainingWorkbook, refs: ImportReferences, mappings: TrainingImportMappings) {
  if (!target) return false;
  const { kind, id } = splitPersonKey(target);
  if (kind === "source") {
    const person = parsed.people.find((item) => item.sourceId === id);
    if (!person) return false;
    const finalTarget = splitPersonKey(mappings.sourcePeople[id] ?? "");
    if (finalTarget.kind === "source") return finalTarget.id === id;
    return refs.people.some((item) => item.id === finalTarget.id);
  }
  if (kind === "existing") return refs.people.some((item) => item.id === id);
  return false;
}

function attendanceValues(item: SourceAttendance, override?: AttendanceResult) {
  const statusKey = normalize(item.attendanceStatus);
  const attendanceStatus: AttendanceStatus | undefined = statusKey === "asiste" ? "ATTENDED" : statusKey === "no asiste" ? "NOT_ATTENDED" : undefined;
  const resultKey = normalize(item.result);
  const sourceResult: AttendanceResult | undefined = resultKey === "apto" ? "PASS" : resultKey === "no apto" ? "FAIL" : resultKey === "no aplica" ? "NOT_APPLICABLE" : resultKey === "pendiente" ? "PENDING" : undefined;
  const result = override ?? sourceResult;
  const valid = Boolean(attendanceStatus && result && result !== "PENDING" && ((attendanceStatus === "ATTENDED" && result !== "NOT_APPLICABLE") || (attendanceStatus === "NOT_ATTENDED" && result === "NOT_APPLICABLE")));
  return { attendanceStatus, result, valid };
}

function build(parsed: ParsedTrainingWorkbook, fileName: string, refs: ImportReferences, provided?: Partial<TrainingImportMappings>) {
  const suggestedMappings = suggestions(parsed, refs);
  const mappings = mergedMappings(suggestedMappings, provided);
  const issues: ImportIssue[] = [];
  const catalogIssue = (field: "trainingType" | "modality" | "department", values: string[], selected: Record<string, string>, options: Array<{ id: string; active: boolean }>, label: string) => {
    for (const value of values) if (!options.some((item) => item.id === selected[value] && item.active)) issues.push({ code: `MISSING_${field.toUpperCase()}_MAPPING`, severity: "ERROR", field, key: value, message: `Selecciona un ${label} válido para «${value}».` });
  };
  const trainingTypes = unique(parsed.sessions.map((item) => item.trainingType));
  const modalities = unique(parsed.sessions.map((item) => item.modality));
  const departments = unique([...parsed.people.map((item) => item.department), ...parsed.attendances.map((item) => item.department ?? "").filter(Boolean)]);
  catalogIssue("trainingType", trainingTypes, mappings.trainingTypes, refs.trainingTypes, "tipo de formación");
  catalogIssue("modality", modalities, mappings.modalities, refs.modalities, "modalidad");
  catalogIssue("department", departments, mappings.departments, refs.departments, "departamento");

  for (const person of parsed.people) {
    const target = mappings.sourcePeople[person.sourceId];
    const split = target ? splitPersonKey(target) : undefined;
    const validSelf = split?.kind === "source" && split.id === person.sourceId;
    const validExisting = split?.kind === "existing" && refs.people.some((item) => item.id === split.id);
    if (!validSelf && !validExisting) issues.push({ code: "INVALID_SOURCE_PERSON_TARGET", severity: "ERROR", field: "sourcePerson", key: person.sourceId, message: `Indica si «${person.fullName}» debe crearse o vincularse con una persona existente.` });
  }
  const trainerNames = unique(parsed.sessions.filter((item) => normalize(item.origin) === "interna").flatMap((item) => item.trainers));
  for (const trainer of trainerNames) if (!validPersonTarget(mappings.trainers[trainer], parsed, refs, mappings)) issues.push({ code: "UNRESOLVED_TRAINER", severity: "ERROR", field: "trainer", key: trainer, message: `Asigna una persona al formador «${trainer}».` });
  const attendeeNames = unique(parsed.attendances.map((item) => item.attendee));
  for (const attendee of attendeeNames) if (!validPersonTarget(mappings.attendees[attendee], parsed, refs, mappings)) issues.push({ code: "UNRESOLVED_ATTENDEE", severity: "ERROR", field: "attendee", key: attendee, message: `Asigna una persona al asistente «${attendee}».` });

  const ambiguousDates: TrainingImportPreview["sourceValues"]["ambiguousDates"] = [];
  for (const session of parsed.sessions) {
    const planningKey = normalize(session.planning);
    const originKey = normalize(session.origin);
    const statusKey = normalize(session.executionStatus);
    if (!["planificada", "no planificada"].includes(planningKey)) issues.push({ code: "INVALID_PLANNING", severity: "ERROR", message: `La planificación de la sesión ${session.sourceId} no es válida.` });
    if (planningKey === "no planificada" && !session.unplannedReason) issues.push({ code: "MISSING_UNPLANNED_REASON", severity: "ERROR", message: `La sesión no planificada ${session.sourceId} requiere motivo.` });
    if (!["interna", "externa"].includes(originKey)) issues.push({ code: "INVALID_ORIGIN", severity: "ERROR", message: `El origen de la sesión ${session.sourceId} no es válido.` });
    if (!["ejecutada", "pendiente"].includes(statusKey)) issues.push({ code: "INVALID_EXECUTION_STATUS", severity: "ERROR", message: `El estado de ejecución de la sesión ${session.sourceId} no es válido.` });
    if (!isoDate(session.plannedDate) && !isoDate(mappings.dateOverrides[session.sourceId]?.plannedDate)) {
      ambiguousDates.push({ sessionId: session.sourceId, field: "plannedDate", rawValue: String(session.plannedDate) });
      issues.push({ code: "AMBIGUOUS_PLANNED_DATE", severity: "ERROR", field: "date", key: session.sourceId, message: `Indica la fecha prevista exacta de la sesión ${session.sourceId} (${String(session.plannedDate)}).` });
    }
    if (normalize(session.executionStatus) === "ejecutada" && !isoDate(session.executionDate) && !isoDate(mappings.dateOverrides[session.sourceId]?.executionDate)) {
      ambiguousDates.push({ sessionId: session.sourceId, field: "executionDate", rawValue: String(session.executionDate ?? "") });
      issues.push({ code: "AMBIGUOUS_EXECUTION_DATE", severity: "ERROR", field: "date", key: session.sourceId, message: `Indica la fecha de ejecución exacta de la sesión ${session.sourceId} (${String(session.executionDate ?? "vacía")}).` });
    }
  }
  const invalidAttendanceResults: TrainingImportPreview["sourceValues"]["invalidAttendanceResults"] = [];
  const sessionsById = new Map(parsed.sessions.map((item) => [item.sourceId, item]));
  for (const attendance of parsed.attendances) {
    if (normalize(sessionsById.get(attendance.sessionId)?.executionStatus ?? "") !== "ejecutada") continue;
    const values = attendanceValues(attendance, mappings.attendanceResults[attendance.rowKey]);
    if (!values.valid) {
      invalidAttendanceResults.push({ key: attendance.rowKey, sessionId: attendance.sessionId, attendee: attendance.attendee, rawValue: attendance.result });
      issues.push({ code: "INVALID_ATTENDANCE_RESULT", severity: "ERROR", field: "attendanceResult", key: attendance.rowKey, message: `Corrige el resultado de ${attendance.attendee} en la sesión ${attendance.sessionId}.` });
    }
  }

  const trainingGroups = mapByNormalized(parsed.sessions, (item) => item.trainingName);
  for (const [nameKey, sessions] of trainingGroups) {
    const selectedDepartments = mappings.trainingDepartments[nameKey] ?? [];
    const invalidDepartment = selectedDepartments.find((id) => !refs.departments.some((department) => department.id === id && department.active));
    if (invalidDepartment) issues.push({ code: "INVALID_TRAINING_DEPARTMENT", severity: "ERROR", field: "trainingDepartment", key: nameKey, message: `Revisa los departamentos destinatarios de «${sessions[0].trainingName}».` });
    if (refs.existingTrainingNames.has(nameKey)) issues.push({ code: "DUPLICATE_TRAINING", severity: "ERROR", field: "duplicate", key: sessions[0].trainingName, message: `Ya existe una formación de 2026 llamada «${sessions[0].trainingName}».` });
    const first = sessions[0];
    for (const item of sessions.slice(1)) {
      const comparable = ["trainingType", "planning", "origin", "modality"] as const;
      if (comparable.some((field) => normalize(item[field]) !== normalize(first[field]))) issues.push({ code: "INCONSISTENT_TRAINING", severity: "ERROR", field: "duplicate", key: first.trainingName, message: `Las sesiones agrupadas bajo «${first.trainingName}» tienen datos maestros incompatibles.` });
    }
  }
  if (parsed.sessions.some((item) => normalize(item.origin) === "interna")) {
    issues.push({ code: "HISTORICAL_EVALUATION_MISSING", severity: "WARNING", message: "La plantilla histórica no incluye método de evaluación ni criterio de aptitud. Se importarán vacíos y deberán completarse antes de nuevas ejecuciones." });
    issues.push({ code: "HISTORICAL_TRAINER_QUALIFICATION_NOT_VERIFIED", severity: "WARNING", message: "La importación histórica vincula los formadores internos por identidad y no reconstruye retrospectivamente su cualificación. El tipo INTERNO/EXTERNO de la Persona no limita esa vinculación; las nuevas selecciones sí exigen una cualificación vigente." });
  }
  if (parsed.duplicateAttendanceRows > 0) issues.push({ code: "DUPLICATE_ATTENDANCE_CONSOLIDATED", severity: "WARNING", message: `${parsed.duplicateAttendanceRows} fila de asistencia repetida se consolidará para respetar el registro único por persona y sesión.` });

  const peopleOptions: ImportPersonOption[] = [
    ...parsed.people.map((item) => ({ key: personKey("source", item.sourceId), label: `${item.fullName} (${item.sourceId}) · plantilla${item.active ? "" : " · inactiva"}`, personType: "INTERNAL" as const, active: item.active })),
    ...refs.people.map((item) => ({ key: personKey("existing", item.id), label: `${item.fullName}${item.employeeCode ? ` (${item.employeeCode})` : ""} · existente${item.active ? "" : " · inactiva"}`, personType: item.personType, active: item.active })),
  ];
  const preview: TrainingImportPreview = {
    fingerprint: parsed.fingerprint,
    fileName,
    counts: {
      sourcePeople: parsed.people.length,
      peopleToCreate: parsed.people.filter((item) => splitPersonKey(mappings.sourcePeople[item.sourceId] ?? ":").kind === "source").length,
      peopleToReuse: parsed.people.filter((item) => splitPersonKey(mappings.sourcePeople[item.sourceId] ?? ":").kind === "existing").length,
      trainings: trainingGroups.size,
      sessions: parsed.sessions.length,
      attendances: parsed.attendances.length,
      executedSessions: parsed.sessions.filter((item) => normalize(item.executionStatus) === "ejecutada").length,
    },
    sourceValues: {
      trainingTypes,
      modalities,
      departments,
      trainingDepartments: [...trainingGroups.entries()].map(([key, sessions]) => ({
        key,
        label: sessions[0].trainingName,
        sourceDepartments: unique(parsed.attendances
          .filter((attendance) => sessions.some((session) => session.sourceId === attendance.sessionId))
          .map((attendance) => attendance.department ?? "")
          .filter(Boolean)),
      })),
      sourcePeople: parsed.people.map((item) => ({ key: item.sourceId, label: item.fullName, suggestedTarget: mappings.sourcePeople[item.sourceId] ?? "" })),
      trainers: trainerNames,
      unresolvedAttendees: attendeeNames.filter((item) => !validPersonTarget(mappings.attendees[item], parsed, refs, mappings)),
      ambiguousDates,
      invalidAttendanceResults,
    },
    options: { trainingTypes: refs.trainingTypes, modalities: refs.modalities, departments: refs.departments, people: peopleOptions },
    suggestedMappings: mappings,
    issues,
    canCommit: !issues.some((item) => item.severity === "ERROR"),
  };

  const resolvedPeople: ResolvedPerson[] = parsed.people.map((item) => ({ ...item, target: mappings.sourcePeople[item.sourceId] }));
  const resolvedTrainings: ResolvedTraining[] = [...trainingGroups.entries()].map(([sourceNameKey, sessions]) => {
    const first = sessions[0];
    const originType = normalize(first.origin) === "externa" ? "EXTERNAL" as const : "INTERNAL" as const;
    const sessionRecords: ResolvedSession[] = sessions.map((session) => ({
      ...session,
      plannedDateIso: isoDate(session.plannedDate) ?? mappings.dateOverrides[session.sourceId]?.plannedDate ?? "",
      executionDateIso: normalize(session.executionStatus) === "ejecutada" ? (isoDate(session.executionDate) ?? mappings.dateOverrides[session.sourceId]?.executionDate) : undefined,
      trainerTargets: originType === "INTERNAL" ? session.trainers.map((trainer) => mappings.trainers[trainer]).filter(Boolean) : [],
      attendances: parsed.attendances.filter((item) => item.sessionId === session.sourceId).map((item) => {
        const values = attendanceValues(item, mappings.attendanceResults[item.rowKey]);
        return { ...item, personTarget: mappings.attendees[item.attendee], attendanceStatus: values.attendanceStatus!, result: values.result! };
      }),
    }));
    return {
      year: 2026,
      name: first.trainingName,
      planningType: normalize(first.planning) === "planificada" ? "PLANNED" : "UNPLANNED",
      trainingTypeId: mappings.trainingTypes[first.trainingType],
      reason: first.unplannedReason,
      isGmp: first.isGmp,
      originType,
      modalityId: mappings.modalities[first.modality],
      plannedDurationMinutes: Math.round(first.durationHours * 60),
      materialReference: first.materialReference,
      content: first.content,
      targetGroup: first.targetGroup,
      targetDepartmentIds: mappings.trainingDepartments[sourceNameKey] ?? [],
      plannedTrainerPersonIds: [],
      externalTrainerNames: originType === "EXTERNAL" ? unique(sessions.flatMap((session) => session.trainers)) : [],
      evaluationMethodId: undefined,
      aptitudeCriterion: undefined,
      frequencyMonths: first.frequencyMonths,
      notes: first.notes,
      sourceNameKey,
      sessions: sessionRecords,
    };
  });
  return { preview, resolved: { fingerprint: parsed.fingerprint, people: resolvedPeople, trainings: resolvedTrainings } satisfies ResolvedTrainingImport };
}

export async function previewTrainingImport(buffer: Buffer, fileName: string, provided?: Partial<TrainingImportMappings>) {
  const parsed = await parseTrainingWorkbook(buffer);
  return build(parsed, fileName, await references(), provided).preview;
}

const demoFingerprints = new Set<string>();

export async function commitTrainingImport(buffer: Buffer, fileName: string, rawMappings: unknown, actor: CurrentUser): Promise<TrainingImportResult> {
  const mappings = trainingImportMappingsSchema.parse(rawMappings);
  const parsed = await parseTrainingWorkbook(buffer);
  const { preview, resolved } = build(parsed, fileName, await references(), mappings);
  if (!preview.canCommit) throw new TrainingImportValidationError(preview);
  if (shouldUsePersistentRepositories()) return commitPersistent(resolved, preview, actor);
  if (shouldUsePortableSharePoint()) {
    return getPortableProvider().writes.execute("TRAINING_IMPORT", () => commitRepositoryImport(resolved, preview, actor, mappings));
  }
  return commitRepositoryImport(resolved, preview, actor, mappings);
}

async function commitRepositoryImport(resolved: ResolvedTrainingImport, preview: TrainingImportPreview, actor: CurrentUser, mappings: TrainingImportMappings): Promise<TrainingImportResult> {
  const portable = shouldUsePortableSharePoint();
  const auditRepository = getAuditEventRepository();
  const portablePrior = portable ? await getPortableProvider().store.findUnique("TrainingImportRun", resolved.fingerprint) : undefined;
  const priorImports = await auditRepository.list({ action: "TRAINING_IMPORT_COMPLETED", limit: 200 });
  const alreadyImported = priorImports.some((event) => {
    const context = event.contextJson as { sourceFingerprint?: string } | undefined;
    return context?.sourceFingerprint === resolved.fingerprint;
  });
  if (portablePrior || demoFingerprints.has(resolved.fingerprint) || alreadyImported) throw new TrainingImportConflictError(portable ? "Este archivo ya fue importado anteriormente" : "Este archivo ya se ha importado en la demostración");

  const peopleRepository = getPeopleRepository();
  const trainingRepository = getTrainingRepository();
  const sessionRepository = getSessionRepository();
  const resolvedPersonIds = new Map<string, string>();
  for (const sourcePerson of resolved.people) {
    const target = splitPersonKey(sourcePerson.target);
    if (target.kind === "existing") resolvedPersonIds.set(personKey("source", sourcePerson.sourceId), target.id);
    else {
      const created = await peopleRepository.create(personInput(sourcePerson, mappings), actor.id);
      if (!sourcePerson.active) await peopleRepository.deactivate(created.id, actor.id);
      resolvedPersonIds.set(personKey("source", sourcePerson.sourceId), created.id);
    }
  }
  const resolvePersonId = (target: string) => splitPersonKey(target).kind === "existing" ? splitPersonKey(target).id : resolvedPersonIds.get(target)!;
  for (const sourceTraining of resolved.trainings) {
    const sourceSessions = sourceTraining.sessions;
    const trainingInput = Object.fromEntries(Object.entries(sourceTraining).filter(([key]) => key !== "sessions" && key !== "sourceNameKey")) as TrainingInput;
    const plannedTrainerPersonIds = sourceTraining.originType === "INTERNAL"
      ? unique(sourceSessions.flatMap((session) => session.trainerTargets).map(resolvePersonId))
      : [];
    const createdTraining = await trainingRepository.create({ ...trainingInput, plannedTrainerPersonIds }, actor.id);
    for (const sourceSession of sourceSessions) await sessionRepository.importHistorical({
      trainingId: createdTraining.id,
      plannedDate: sourceSession.plannedDateIso,
      executionDate: sourceSession.executionDateIso,
      trainerPersonIds: sourceTraining.originType === "INTERNAL" ? unique(sourceSession.trainerTargets.map(resolvePersonId)) : [],
      externalTrainerNames: sourceTraining.originType === "EXTERNAL" ? sourceSession.trainers : [],
      durationMinutes: Math.round(sourceSession.durationHours * 60),
      executionStatus: normalize(sourceSession.executionStatus) === "ejecutada" ? "EXECUTED" : "PENDING",
      notes: sourceSession.notes,
      attendances: sourceSession.attendances.map((item) => ({ personId: resolvePersonId(item.personTarget), attendanceStatus: item.attendanceStatus, result: item.result, notes: item.notes })),
    }, actor);
  }
  demoFingerprints.add(resolved.fingerprint);
  const importId = crypto.randomUUID();
  if (portable) await getPortableProvider().store.create("TrainingImportRun", importId, {
    id: importId,
    sourceFingerprint: resolved.fingerprint,
    year: 2026,
    actorUserId: actor.id,
    summaryJson: preview.counts,
    createdAt: new Date().toISOString(),
  }, { uniqueKey: resolved.fingerprint, year: 2026, status: "COMPLETED" });
  await auditRepository.append({ actorUserId: actor.id, entityType: "TRAINING_IMPORT", entityId: importId, action: "TRAINING_IMPORT_COMPLETED", contextJson: { sourceFingerprint: resolved.fingerprint, counts: preview.counts } });
  return { importId, fingerprint: resolved.fingerprint, counts: preview.counts };
}

function personInput(person: ResolvedPerson, mappings: TrainingImportMappings): PersonInput {
  return { fullName: person.fullName, employeeCode: person.sourceId, personType: "INTERNAL", departmentId: mappings.departments[person.department], jobTitle: person.jobTitle, notes: person.notes };
}

async function commitPersistent(resolved: ResolvedTrainingImport, preview: TrainingImportPreview, actor: CurrentUser): Promise<TrainingImportResult> {
  return prisma.$transaction(async (transaction) => {
    const prior = await transaction.trainingImportRun.findUnique({ where: { sourceFingerprint: resolved.fingerprint } });
    if (prior) throw new TrainingImportConflictError("Este archivo ya fue importado anteriormente");
    const resolvedPersonIds = new Map<string, string>();
    for (const sourcePerson of resolved.people) {
      const target = splitPersonKey(sourcePerson.target);
      if (target.kind === "existing") resolvedPersonIds.set(personKey("source", sourcePerson.sourceId), target.id);
      else {
        const person = await transaction.person.create({ data: {
          fullName: sourcePerson.fullName,
          employeeCode: sourcePerson.sourceId,
          personType: "INTERNAL",
          departmentId: preview.suggestedMappings.departments[sourcePerson.department],
          jobTitle: sourcePerson.jobTitle,
          notes: sourcePerson.notes ?? null,
          active: sourcePerson.active,
        } });
        resolvedPersonIds.set(personKey("source", sourcePerson.sourceId), person.id);
      }
    }
    const resolvePersonId = (target: string) => splitPersonKey(target).kind === "existing" ? splitPersonKey(target).id : resolvedPersonIds.get(target)!;
    const sequence = await transaction.trainingCodeSequence.upsert({ where: { year: 2026 }, create: { year: 2026, lastValue: resolved.trainings.length }, update: { lastValue: { increment: resolved.trainings.length } } });
    let trainingSequence = sequence.lastValue - resolved.trainings.length;
    for (const sourceTraining of resolved.trainings) {
      trainingSequence += 1;
      const plannedTrainerPersonIds = sourceTraining.originType === "INTERNAL" ? unique(sourceTraining.sessions.flatMap((session) => session.trainerTargets).map(resolvePersonId)) : [];
      const training = await transaction.training.create({ data: {
        code: formatTrainingCode(2026, trainingSequence),
        year: 2026,
        name: sourceTraining.name,
        planningType: sourceTraining.planningType,
        trainingTypeId: sourceTraining.trainingTypeId ?? null,
        reason: sourceTraining.reason ?? null,
        isGmp: sourceTraining.isGmp,
        originType: sourceTraining.originType,
        modalityId: sourceTraining.modalityId ?? null,
        plannedDurationMinutes: sourceTraining.plannedDurationMinutes ?? null,
        materialReference: sourceTraining.materialReference ?? null,
        content: sourceTraining.content ?? null,
        targetGroup: sourceTraining.targetGroup ?? null,
        plannedExternalTrainerNames: sourceTraining.originType === "EXTERNAL" ? (sourceTraining.externalTrainerNames ?? []) : [],
        plannedTrainerLinks: { create: plannedTrainerPersonIds.map((personId) => ({ personId })) },
        targetDepartmentLinks: { create: (sourceTraining.targetDepartmentIds ?? []).map((departmentId) => ({ departmentId })) },
        frequencyMonths: sourceTraining.frequencyMonths ?? null,
        notes: sourceTraining.notes ?? null,
        createdByUserId: actor.id,
      } });
      for (let index = 0; index < sourceTraining.sessions.length; index += 1) {
        const sourceSession = sourceTraining.sessions[index];
        const executed = normalize(sourceSession.executionStatus) === "ejecutada";
        await transaction.trainingSession.create({ data: {
          trainingId: training.id,
          code: formatSessionCode(training.code, index + 1),
          plannedDate: new Date(`${sourceSession.plannedDateIso}T00:00:00.000Z`),
          executionDate: executed ? new Date(`${sourceSession.executionDateIso}T00:00:00.000Z`) : null,
          externalTrainerNames: sourceTraining.originType === "EXTERNAL" ? sourceSession.trainers : [],
          trainerLinks: { create: sourceTraining.originType === "INTERNAL" ? unique(sourceSession.trainerTargets.map(resolvePersonId)).map((personId) => ({ personId })) : [] },
          durationMinutes: Math.round(sourceSession.durationHours * 60),
          executionStatus: executed ? "EXECUTED" : "PENDING",
          notes: sourceSession.notes ?? null,
          executedAt: executed ? new Date() : null,
          executedByUserId: executed ? actor.id : null,
          attendances: { create: sourceSession.attendances.map((item) => ({
            personId: resolvePersonId(item.personTarget),
            attendanceStatus: executed ? item.attendanceStatus : "EXPECTED",
            result: executed ? item.result : "PENDING",
            notes: item.notes ?? null,
          })) },
        } });
      }
      await transaction.sessionCodeSequence.create({ data: { trainingId: training.id, lastValue: sourceTraining.sessions.length } });
    }
    const run = await transaction.trainingImportRun.create({ data: {
      sourceFingerprint: resolved.fingerprint,
      year: 2026,
      actorUserId: actor.id,
      summaryJson: preview.counts,
    } });
    await transaction.auditEvent.create({ data: {
      actorUserId: actor.id,
      entityType: "TRAINING_IMPORT",
      entityId: run.id,
      action: "TRAINING_IMPORT_COMPLETED",
      contextJson: { sourceFingerprint: resolved.fingerprint, counts: preview.counts },
    } });
    return { importId: run.id, fingerprint: resolved.fingerprint, counts: preview.counts };
  }, { timeout: 60_000 });
}
