import { canAccessAdministration, type CurrentUser } from "@/auth/current-user";
import type { Department } from "@/domain/department";
import type { Person } from "@/domain/person";
import type { TrainingCatalogs } from "@/domain/training-catalogs";
import type { Training } from "@/domain/training";
import { calculateTrainingStatus, type Attendance, type TrainingGlobalStatus, type TrainingSession } from "@/domain/training-session";
import type { PeopleRepository } from "@/server/people-repository";
import type { SessionRepository } from "@/server/session-repository";
import type { TrainingRepository } from "@/server/training-repository";
import { INTEGRITY_ISSUE_LABELS, type IntegrityIssue, type IntegrityIssueBreakdown, type IntegrityIssueCode, type IntegritySeverity, type ReferenceDisposition, type TrainingIntegrityRecord, type TrainingIntegrityReport } from "@/integrity/types";

export class TrainingIntegrityAuthorizationError extends Error {
  constructor() { super("No autorizado para revisar la integridad de los datos"); }
}

export type TrainingIntegrityDataset = {
  trainings: Training[];
  sessions: TrainingSession[];
  people: Person[];
  departments: Department[];
  catalogs: TrainingCatalogs;
};

type IssueContext = {
  training?: Training;
  session?: TrainingSession;
  status?: TrainingGlobalStatus;
  departmentIds?: string[];
};

const present = (value: string | undefined) => Boolean(value?.trim());
const unique = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))];
const rawTrainingTrainerIds = (training: Training) => training.plannedTrainerPersonIds?.length
  ? training.plannedTrainerPersonIds
  : training.plannedTrainerPersonId ? [training.plannedTrainerPersonId] : [];
const rawTrainingExternalNames = (training: Training) => training.externalTrainerNames?.length
  ? training.externalTrainerNames
  : training.externalTrainerName ? [training.externalTrainerName] : [];
const rawSessionTrainerIds = (session: TrainingSession) => session.trainerPersonIds?.length
  ? session.trainerPersonIds
  : session.trainerPersonId ? [session.trainerPersonId] : [];
const rawSessionExternalNames = (session: TrainingSession) => session.externalTrainerNames?.length
  ? session.externalTrainerNames
  : session.externalTrainerName ? [session.externalTrainerName] : [];
const hasDuplicates = (values: string[]) => new Set(values).size !== values.length;
const validDate = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const attendanceIsConsistent = (attendance: Attendance) => {
  if (attendance.attendanceStatus === "EXPECTED") return attendance.result === "PENDING";
  if (attendance.attendanceStatus === "ATTENDED") return attendance.result === "PASS" || attendance.result === "FAIL";
  return attendance.result === "NOT_APPLICABLE";
};
const dispositionForStatus = (status: TrainingGlobalStatus | TrainingSession["executionStatus"]): ReferenceDisposition =>
  status === "PENDING" ? "REVIEW_REQUIRED" : "HISTORICAL_VALID";
const dispositionText = (disposition: ReferenceDisposition) => disposition === "HISTORICAL_VALID"
  ? "Se conserva como referencia histórica válida."
  : "Debe revisarse antes de continuar con la formación pendiente.";

export function analyzeTrainingIntegrity(dataset: TrainingIntegrityDataset): TrainingIntegrityReport {
  const people = new Map(dataset.people.map((person) => [person.id, person]));
  const departments = new Map(dataset.departments.map((department) => [department.id, department]));
  const trainingTypes = new Map(dataset.catalogs.trainingTypes.map((item) => [item.id, item]));
  const modalities = new Map(dataset.catalogs.modalities.map((item) => [item.id, item]));
  const evaluationMethods = new Map(dataset.catalogs.evaluationMethods.map((item) => [item.id, item]));
  const trainings = new Map(dataset.trainings.map((training) => [training.id, training]));
  const sessionsByTraining = new Map<string, TrainingSession[]>();
  for (const session of dataset.sessions) {
    const current = sessionsByTraining.get(session.trainingId) ?? [];
    current.push(session);
    sessionsByTraining.set(session.trainingId, current);
  }

  const issues: IntegrityIssue[] = [];
  const issueKeys = new Set<string>();
  let issueSequence = 0;

  const relatedDepartments = (training: Training | undefined, sessions: TrainingSession[]) => unique([
    ...(training?.targetDepartmentIds ?? []),
    ...(training ? rawTrainingTrainerIds(training).map((id) => people.get(id)?.departmentId) : []),
    ...sessions.flatMap((session) => [
      ...rawSessionTrainerIds(session).map((id) => people.get(id)?.departmentId),
      ...session.attendances.map((attendance) => people.get(attendance.personId)?.departmentId),
    ]),
  ]);

  const addIssue = (
    code: IntegrityIssueCode,
    severity: IntegritySeverity,
    message: string,
    context: IssueContext,
    options: { referenceDisposition?: ReferenceDisposition; key?: string } = {},
  ) => {
    const training = context.training;
    const session = context.session;
    const key = options.key ?? [code, severity, training?.id, session?.id, message].join("|");
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    issues.push({
      id: `integrity-${++issueSequence}`,
      code,
      title: INTEGRITY_ISSUE_LABELS[code],
      severity,
      message,
      entityType: session ? "SESSION" : "TRAINING",
      trainingId: training?.id,
      trainingCode: training?.code,
      trainingName: training?.name,
      sessionId: session?.id,
      sessionCode: session?.code,
      year: training?.year,
      trainingStatus: context.status,
      departmentIds: context.departmentIds ?? [],
      href: session ? `/sesiones/${session.id}` : training ? `/formaciones/${training.id}` : "/administracion/revision-datos",
      referenceDisposition: options.referenceDisposition,
    });
  };

  const checkPersonReference = (
    personId: string,
    label: string,
    context: IssueContext,
    disposition: ReferenceDisposition,
  ) => {
    const person = people.get(personId);
    if (!person) {
      addIssue("MISSING_PERSON_REFERENCE", "ERROR", `${label}: la persona con ID ${personId} no existe.`, context, { key: `missing-person|${context.training?.id}|${context.session?.id}|${label}|${personId}` });
      return undefined;
    }
    if (!person.active) {
      addIssue("INACTIVE_PERSON_REFERENCE", "WARNING", `${label}: ${person.fullName} está inactiva. ${dispositionText(disposition)}`, context, { referenceDisposition: disposition, key: `inactive-person|${context.training?.id}|${context.session?.id}|${label}|${personId}` });
    }
    if (person.personType === "INTERNAL" && !person.departmentId) {
      addIssue("PERSON_PROFILE_INCOMPLETE", "ERROR", `${label}: ${person.fullName} es personal interno y no tiene departamento.`, context, { key: `person-department|${context.training?.id}|${context.session?.id}|${label}|${personId}` });
    }
    if (person.departmentId) {
      const department = departments.get(person.departmentId);
      if (!department) {
        addIssue("MISSING_DEPARTMENT_REFERENCE", "ERROR", `${label}: el departamento de ${person.fullName} ya no existe.`, context, { key: `person-missing-department|${context.training?.id}|${context.session?.id}|${label}|${personId}|${person.departmentId}` });
      } else if (!department.active) {
        addIssue("INACTIVE_DEPARTMENT_REFERENCE", "WARNING", `${label}: ${person.fullName} pertenece al departamento inactivo ${department.name}. ${dispositionText(disposition)}`, context, { referenceDisposition: disposition, key: `person-inactive-department|${context.training?.id}|${context.session?.id}|${label}|${personId}|${department.id}` });
      }
    }
    return person;
  };

  const trainingRecords: TrainingIntegrityRecord[] = [];

  for (const training of dataset.trainings) {
    const sessions = sessionsByTraining.get(training.id) ?? [];
    const status = calculateTrainingStatus(sessions);
    const departmentIds = relatedDepartments(training, sessions);
    const context: IssueContext = { training, status, departmentIds };
    const disposition = dispositionForStatus(status);
    const internalTrainerIds = rawTrainingTrainerIds(training);
    const externalTrainerNames = rawTrainingExternalNames(training);
    const targetDepartmentIds = training.targetDepartmentIds ?? [];

    if (!new RegExp(`^FOR-${training.year}-\\d{4}$`).test(training.code)) {
      addIssue("TRAINING_CODE_INCONSISTENCY", "ERROR", `El código ${training.code} no corresponde al año ${training.year}.`, context);
    }
    if (training.planningType === "UNPLANNED" && !present(training.reason)) {
      addIssue("UNPLANNED_REASON_MISSING", "ERROR", "La formación no planificada no tiene motivo.", context);
    }
    if (!training.trainingTypeId) addIssue("TRAINING_TYPE_MISSING", "WARNING", "Debe revisarse y asignarse un tipo de formación.", context);
    if (!training.modalityId) addIssue("MODALITY_MISSING", "WARNING", "Debe revisarse y asignarse una modalidad.", context);
    if (!training.plannedDurationMinutes) addIssue("TRAINING_DURATION_MISSING", "WARNING", "No consta la duración prevista.", context);
    if (!present(training.materialReference)) addIssue("MATERIAL_REFERENCE_MISSING", "WARNING", "No consta material o documento de referencia.", context);
    if (!present(training.content)) addIssue("TRAINING_CONTENT_MISSING", "WARNING", "No consta el contenido de la formación.", context);
    if (!present(training.targetGroup)) addIssue("TARGET_GROUP_MISSING", "WARNING", "No consta el colectivo objetivo.", context);
    if (targetDepartmentIds.length === 0) addIssue("TARGET_DEPARTMENT_MISSING", "WARNING", "No hay departamentos destinatarios configurados.", context);
    if (sessions.length === 0) addIssue("TRAINING_WITHOUT_SESSIONS", "WARNING", "La formación todavía no tiene ninguna sesión creada.", context);

    if (training.originType === "INTERNAL") {
      if (!training.evaluationMethodId) addIssue("INTERNAL_EVALUATION_METHOD_MISSING", "WARNING", "La formación interna no tiene método de evaluación definido.", context);
      if (!present(training.aptitudeCriterion)) addIssue("INTERNAL_APTITUDE_CRITERION_MISSING", "WARNING", "La formación interna no tiene criterio de aptitud definido.", context);
      if (internalTrainerIds.length === 0) addIssue("PLANNED_TRAINER_MISSING", "WARNING", "No hay ningún formador cualificado previsto.", context);
      if (externalTrainerNames.length > 0) addIssue("TRAINER_ORIGIN_MISMATCH", "ERROR", "Una formación interna contiene nombres manuales de formador; debe seleccionarse una persona cualificada interna o externa.", context);
    } else if (internalTrainerIds.length === 0 && externalTrainerNames.length === 0) {
      addIssue("PLANNED_TRAINER_MISSING", "WARNING", "No hay ningún formador externo previsto.", context);
    }

    if (training.globalStatus && training.globalStatus !== status) {
      addIssue("TRAINING_STATUS_MISMATCH", "ERROR", `El estado informado es ${training.globalStatus}, pero las sesiones determinan ${status}.`, context);
    }
    if (hasDuplicates(targetDepartmentIds)) addIssue("DUPLICATE_REFERENCE", "ERROR", "Hay departamentos destinatarios duplicados.", context);
    if (hasDuplicates(internalTrainerIds) || hasDuplicates(externalTrainerNames.map((name) => name.toLocaleLowerCase("es")))) {
      addIssue("DUPLICATE_REFERENCE", "ERROR", "Hay formadores previstos duplicados.", context);
    }

    const catalogChecks = [
      ["tipo de formación", training.trainingTypeId, trainingTypes],
      ["modalidad", training.modalityId, modalities],
      ["método de evaluación", training.evaluationMethodId, evaluationMethods],
    ] as const;
    for (const [label, id, catalog] of catalogChecks) {
      if (!id) continue;
      const item = catalog.get(id);
      if (!item) addIssue("MISSING_CATALOG_REFERENCE", "ERROR", `La referencia de ${label} (${id}) no existe.`, context, { key: `missing-catalog|${training.id}|${label}|${id}` });
      else if (!item.active) addIssue("INACTIVE_CATALOG_REFERENCE", "WARNING", `El ${label} ${item.name} está inactivo. ${dispositionText(disposition)}`, context, { referenceDisposition: disposition, key: `inactive-catalog|${training.id}|${label}|${id}` });
    }

    for (const departmentId of targetDepartmentIds) {
      const department = departments.get(departmentId);
      if (!department) addIssue("MISSING_DEPARTMENT_REFERENCE", "ERROR", `El departamento destinatario con ID ${departmentId} no existe.`, context, { key: `missing-department|${training.id}|${departmentId}` });
      else if (!department.active) addIssue("INACTIVE_DEPARTMENT_REFERENCE", "WARNING", `El departamento destinatario ${department.name} está inactivo. ${dispositionText(disposition)}`, context, { referenceDisposition: disposition, key: `inactive-department|${training.id}|${departmentId}` });
    }

    for (const trainerId of internalTrainerIds) {
      checkPersonReference(trainerId, "Formador previsto", context, disposition);
    }

    for (const session of sessions) {
      const sessionContext: IssueContext = { training, session, status, departmentIds };
      const sessionDisposition = dispositionForStatus(session.executionStatus);
      const sessionTrainerIds = rawSessionTrainerIds(session);
      const sessionExternalNames = rawSessionExternalNames(session);

      if (!new RegExp(`^${training.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-S\\d{2}$`).test(session.code)) {
        addIssue("SESSION_CODE_INCONSISTENCY", "ERROR", `El código ${session.code} no corresponde a la formación ${training.code}.`, sessionContext);
      }
      if (!validDate(session.plannedDate)) addIssue("SESSION_PLANNED_DATE_INVALID", "ERROR", "La fecha prevista no existe o no tiene un formato válido.", sessionContext);
      if (!Number.isInteger(session.durationMinutes) || session.durationMinutes <= 0) addIssue("SESSION_DURATION_INVALID", "ERROR", "La duración de la sesión debe ser un entero positivo.", sessionContext);

      if (training.originType === "INTERNAL") {
        if (sessionTrainerIds.length === 0) addIssue("SESSION_TRAINER_MISSING", "ERROR", "La sesión interna no tiene formador cualificado.", sessionContext);
        if (sessionExternalNames.length > 0) addIssue("TRAINER_ORIGIN_MISMATCH", "ERROR", "La sesión interna contiene nombres manuales de formador; debe seleccionarse una persona cualificada interna o externa.", sessionContext);
      } else if (sessionTrainerIds.length === 0 && sessionExternalNames.length === 0) {
        addIssue("SESSION_TRAINER_MISSING", "ERROR", "La sesión externa no tiene formador.", sessionContext);
      }

      if (hasDuplicates(sessionTrainerIds) || hasDuplicates(sessionExternalNames.map((name) => name.toLocaleLowerCase("es")))) {
        addIssue("DUPLICATE_REFERENCE", "ERROR", "Hay formadores duplicados en la sesión.", sessionContext);
      }
      for (const trainerId of sessionTrainerIds) {
        checkPersonReference(trainerId, "Formador de sesión", sessionContext, sessionDisposition);
      }

      if (session.executionStatus === "EXECUTED") {
        if (!validDate(session.executionDate)) addIssue("EXECUTION_DATE_MISSING", "ERROR", "La sesión figura ejecutada, pero no tiene una fecha de ejecución válida.", sessionContext);
        if (present(session.nonExecutionReason)) addIssue("SESSION_STATUS_DATA_MISMATCH", "ERROR", "Una sesión ejecutada conserva un motivo de no ejecución.", sessionContext);
        if (!session.executedAt || !session.executedByUserId) addIssue("EXECUTION_TRACE_MISSING", "WARNING", "Falta la fecha/hora o el usuario que registró la ejecución.", sessionContext);
      } else {
        if (session.executionDate) addIssue("SESSION_STATUS_DATA_MISMATCH", "ERROR", `La sesión ${session.executionStatus === "PENDING" ? "pendiente" : "no ejecutada"} conserva una fecha de ejecución.`, sessionContext);
        if (session.executedAt || session.executedByUserId) addIssue("SESSION_STATUS_DATA_MISMATCH", "ERROR", `La sesión ${session.executionStatus === "PENDING" ? "pendiente" : "no ejecutada"} conserva datos de cierre como ejecutada.`, sessionContext);
      }
      if (session.executionStatus === "NOT_EXECUTED" && !present(session.nonExecutionReason)) {
        addIssue("NON_EXECUTION_REASON_MISSING", "ERROR", "La sesión no ejecutada no tiene motivo.", sessionContext);
      }

      const attendancePersonIds = session.attendances.map((attendance) => attendance.personId);
      if (hasDuplicates(attendancePersonIds)) addIssue("DUPLICATE_REFERENCE", "ERROR", "Hay una persona duplicada en las asistencias de la sesión.", sessionContext);
      for (const attendance of session.attendances) {
        checkPersonReference(attendance.personId, "Asistente", sessionContext, sessionDisposition);
        if (!attendanceIsConsistent(attendance)) {
          addIssue("ATTENDANCE_INCONSISTENCY", "ERROR", `La asistencia y el resultado de la persona ${attendance.personId} no son compatibles (${attendance.attendanceStatus}/${attendance.result}).`, sessionContext, { key: `attendance|${session.id}|${attendance.personId}|${attendance.attendanceStatus}|${attendance.result}` });
        }
      }
    }

    const trainingIssues = issues.filter((issue) => issue.trainingId === training.id);
    const classification = trainingIssues.some((issue) => issue.severity === "ERROR")
      ? "ERROR"
      : trainingIssues.length ? "WARNING" : "COMPLETE";
    trainingRecords.push({
      trainingId: training.id,
      trainingCode: training.code,
      trainingName: training.name,
      year: training.year,
      status,
      departmentIds,
      classification,
      issueCount: trainingIssues.length,
    });
  }

  for (const session of dataset.sessions.filter((candidate) => !trainings.has(candidate.trainingId))) {
    const departmentIds = relatedDepartments(undefined, [session]);
    addIssue("SESSION_TRAINING_MISSING", "ERROR", `La sesión ${session.code} referencia una formación inexistente (${session.trainingId}).`, { session, departmentIds });
  }

  issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "ERROR" ? -1 : 1)
    || (b.year ?? 0) - (a.year ?? 0)
    || (a.trainingCode ?? "").localeCompare(b.trainingCode ?? "")
    || (a.sessionCode ?? "").localeCompare(b.sessionCode ?? "")
    || a.title.localeCompare(b.title));

  const breakdown = Object.entries(INTEGRITY_ISSUE_LABELS).map(([code, label]) => {
    const matching = issues.filter((issue) => issue.code === code);
    return {
      code: code as IntegrityIssueCode,
      label,
      count: matching.length,
      errorCount: matching.filter((issue) => issue.severity === "ERROR").length,
      warningCount: matching.filter((issue) => issue.severity === "WARNING").length,
    } satisfies IntegrityIssueBreakdown;
  }).filter((item) => item.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));

  return {
    summary: {
      totalTrainings: trainingRecords.length,
      reviewedSessions: dataset.sessions.length,
      completeTrainings: trainingRecords.filter((item) => item.classification === "COMPLETE").length,
      warningTrainings: trainingRecords.filter((item) => item.classification === "WARNING").length,
      errorTrainings: trainingRecords.filter((item) => item.classification === "ERROR").length,
      totalIssues: issues.length,
      errorIssues: issues.filter((item) => item.severity === "ERROR").length,
      warningIssues: issues.filter((item) => item.severity === "WARNING").length,
    },
    trainings: trainingRecords.sort((a, b) => b.year - a.year || b.trainingCode.localeCompare(a.trainingCode)),
    issues,
    breakdown,
    filters: {
      years: [...new Set(dataset.trainings.map((training) => training.year))].sort((a, b) => b - a),
      departments: dataset.departments.map((department) => ({ id: department.id, name: department.name, active: department.active })).sort((a, b) => a.name.localeCompare(b.name, "es")),
      statuses: ["PENDING", "EXECUTED", "NOT_EXECUTED"],
    },
  };
}

export class TrainingIntegrityService {
  constructor(
    private readonly trainingRepository: TrainingRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly peopleRepository: PeopleRepository,
  ) {}

  async review(actor: CurrentUser): Promise<TrainingIntegrityReport> {
    if (!canAccessAdministration(actor)) throw new TrainingIntegrityAuthorizationError();
    const [trainings, sessions, people, departments, catalogs] = await Promise.all([
      this.trainingRepository.list(),
      this.sessionRepository.listAll(),
      this.peopleRepository.list(),
      this.peopleRepository.listDepartments({ includeInactive: true }),
      this.trainingRepository.listCatalogs({ includeInactive: true }),
    ]);
    return analyzeTrainingIntegrity({ trainings, sessions, people, departments, catalogs });
  }
}
