import type { CurrentUser } from "@/auth/current-user";
import { canCloseSession, canCreateSession, canEditSession, canReopenSession } from "@/auth/current-user";
import { calculateTrainingStatus, formatSessionCode, validateAttendanceCompletion, type Attendance, type FinalizeSessionInput, type NotExecutedInput, type SessionInput, type TrainingGlobalStatus, type TrainingSession } from "@/domain/training-session";
import type { PeopleRepository } from "@/server/people-repository";
import type { TrainingRepository } from "@/server/training-repository";
import { InMemoryAuditEventRepository, type AuditEventRepository } from "@/administration/audit-repository";
import { readDemoJson, writeDemoJson } from "@/demo/demo-data-store";

export interface SessionRepository {
  listAll(): Promise<TrainingSession[]>;
  listByTraining(trainingId: string): Promise<TrainingSession[]>;
  listByTrainingIds(trainingIds: string[]): Promise<TrainingSession[]>;
  listByPerson(personId: string): Promise<TrainingSession[]>;
  findById(id: string): Promise<TrainingSession | undefined>;
  create(input: SessionInput, actor: CurrentUser): Promise<TrainingSession>;
  update(id: string, input: SessionInput, actor: CurrentUser): Promise<TrainingSession | undefined>;
  finalize(id: string, input: FinalizeSessionInput, actor: CurrentUser): Promise<TrainingSession | undefined>;
  markNotExecuted(id: string, input: NotExecutedInput, actor: CurrentUser): Promise<TrainingSession | undefined>;
  reopen(id: string, reason: string, actor: CurrentUser): Promise<TrainingSession | undefined>;
  importHistorical(input: HistoricalSessionImportInput, actor: CurrentUser): Promise<TrainingSession>;
  trainingStatus(trainingId: string): Promise<TrainingGlobalStatus>;
}

export type HistoricalSessionImportInput = {
  trainingId: string;
  plannedDate: string;
  executionDate?: string;
  trainerPersonIds?: string[];
  externalTrainerNames?: string[];
  trainerPersonId?: string;
  externalTrainerName?: string;
  durationMinutes: number;
  blankAttendanceRows?: number;
  executionStatus: "PENDING" | "EXECUTED";
  notes?: string;
  attendances: Array<Pick<Attendance, "personId" | "attendanceStatus" | "result" | "notes">>;
};

export class SessionAuthorizationError extends Error { constructor() { super("No autorizado para realizar esta operación sobre la sesión"); } }
export class SessionImmutableFieldError extends Error { constructor() { super("El código y la formación de una sesión no pueden modificarse"); } }
export class SessionStateError extends Error { constructor(message = "La sesión debe estar pendiente") { super(message); } }
export class SessionRelationError extends Error {}

const fixedTime = "2026-01-15T09:00:00.000Z";
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const trainerIds = (input: { trainerPersonIds?: string[]; trainerPersonId?: string }) => unique(input.trainerPersonIds ?? (input.trainerPersonId ? [input.trainerPersonId] : []));
const externalNames = (input: { externalTrainerNames?: string[]; externalTrainerName?: string }) => unique(input.externalTrainerNames ?? (input.externalTrainerName ? [input.externalTrainerName] : []));
const attendance = (id: string, sessionId: string, personId: string, attendanceStatus: Attendance["attendanceStatus"], result: Attendance["result"], notes?: string): Attendance => ({
  id, sessionId, personId, attendanceStatus, result, notes, createdAt: fixedTime, updatedAt: fixedTime,
});

export const demoSessions: TrainingSession[] = [
  {
    id: "session-demo-1", trainingId: "training-demo-1", code: "FOR-2026-0001-S01", plannedDate: "2026-02-10", executionDate: "2026-02-10",
    trainerPersonId: "demo-1", durationMinutes: 120, executionStatus: "EXECUTED", createdAt: fixedTime, updatedAt: fixedTime,
    executedAt: fixedTime, executedByUserId: "demo-user", notes: "Sesión ejecutada ficticia",
    attendances: [attendance("attendance-demo-1", "session-demo-1", "demo-1", "ATTENDED", "PASS"), attendance("attendance-demo-2", "session-demo-1", "demo-2", "ATTENDED", "FAIL", "Requiere refuerzo ficticio")],
  },
  {
    id: "session-demo-2", trainingId: "training-demo-1", code: "FOR-2026-0001-S02", plannedDate: "2026-10-20", trainerPersonId: "demo-1",
    durationMinutes: 120, executionStatus: "PENDING", createdAt: fixedTime, updatedAt: fixedTime,
    attendances: [attendance("attendance-demo-3", "session-demo-2", "demo-1", "EXPECTED", "PENDING"), attendance("attendance-demo-4", "session-demo-2", "demo-2", "EXPECTED", "PENDING")],
  },
  {
    id: "session-demo-3", trainingId: "training-demo-2", code: "FOR-2026-0002-S01", plannedDate: "2026-03-12", externalTrainerName: "Formador externo ficticio",
    durationMinutes: 90, executionStatus: "NOT_EXECUTED", nonExecutionReason: "Cambio de agenda ficticio", createdAt: fixedTime, updatedAt: fixedTime,
    attendances: [attendance("attendance-demo-5", "session-demo-3", "demo-2", "EXPECTED", "PENDING")],
  },
  {
    id: "session-demo-4", trainingId: "training-demo-3", code: "FOR-2025-0001-S01", plannedDate: "2025-05-05", executionDate: "2025-05-05",
    trainerPersonId: "demo-1", durationMinutes: 60, executionStatus: "EXECUTED", createdAt: fixedTime, updatedAt: fixedTime, executedAt: fixedTime, executedByUserId: "demo-user",
    attendances: [attendance("attendance-demo-6", "session-demo-4", "demo-1", "ATTENDED", "PASS"), attendance("attendance-demo-7", "session-demo-4", "demo-2", "NOT_ATTENDED", "NOT_APPLICABLE", "Ausencia ficticia"), attendance("attendance-demo-8", "session-demo-4", "demo-3", "ATTENDED", "PASS", "Histórico ficticio")],
  },
  {
    id: "session-demo-5", trainingId: "training-demo-5", code: "FOR-2026-0004-S01", plannedDate: "2026-06-12", executionDate: "2026-06-15",
    externalTrainerName: "Entidad formadora ficticia", durationMinutes: 75, executionStatus: "EXECUTED", createdAt: fixedTime, updatedAt: "2026-06-15T10:00:00.000Z", executedAt: "2026-06-15T10:00:00.000Z", executedByUserId: "demo-user",
    attendances: [attendance("attendance-demo-9", "session-demo-5", "demo-1", "ATTENDED", "PASS"), attendance("attendance-demo-10", "session-demo-5", "demo-2", "ATTENDED", "FAIL", "Refuerzo pendiente ficticio")],
  },
];

export class InMemorySessionRepository implements SessionRepository {
  private sessions: TrainingSession[];
  private lastSequence = new Map<string, number>();

  constructor(
    private readonly trainings: TrainingRepository,
    private readonly people: PeopleRepository,
    seed?: TrainingSession[],
    private readonly audit: AuditEventRepository = new InMemoryAuditEventRepository(),
    private readonly persist = false,
  ) {
    const initial = seed ?? (persist ? readDemoJson<TrainingSession[]>("sessions-current.json") : undefined) ?? demoSessions;
    this.sessions = structuredClone(initial);
    for (const session of initial) this.lastSequence.set(session.trainingId, Math.max(this.lastSequence.get(session.trainingId) ?? 0, Number(session.code.slice(-2)) || 0));
  }

  private save() { if (this.persist) writeDemoJson("sessions-current.json", this.sessions); }

  async listAll() { return structuredClone(this.sessions); }
  async listByTraining(trainingId: string) { return structuredClone(this.sessions.filter((session) => session.trainingId === trainingId).sort((a, b) => a.code.localeCompare(b.code))); }
  async listByTrainingIds(trainingIds: string[]) {
    const ids = new Set(trainingIds);
    return structuredClone(this.sessions.filter((session) => ids.has(session.trainingId)).sort((a, b) => a.code.localeCompare(b.code)));
  }
  async listByPerson(personId: string) { return structuredClone(this.sessions.filter((session) => session.attendances.some((attendance) => attendance.personId === personId))); }
  async findById(id: string) { const found = this.sessions.find((session) => session.id === id); return found ? structuredClone(found) : undefined; }
  async trainingStatus(trainingId: string) { return calculateTrainingStatus(await this.listByTraining(trainingId)); }

  async importHistorical(input: HistoricalSessionImportInput, actor: CurrentUser) {
    if (actor.role !== "ADMIN") throw new SessionAuthorizationError();
    const training = await this.trainings.findById(input.trainingId);
    if (!training) throw new SessionRelationError("La formación asociada no existe");
    const sequence = (this.lastSequence.get(training.id) ?? 0) + 1;
    const timestamp = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const session: TrainingSession = {
      id: sessionId,
      trainingId: training.id,
      code: formatSessionCode(training.code, sequence),
      plannedDate: input.plannedDate,
      executionDate: input.executionDate,
      trainerPersonIds: trainerIds(input),
      trainerPersonId: trainerIds(input)[0],
      externalTrainerNames: externalNames(input),
      externalTrainerName: externalNames(input)[0],
      durationMinutes: input.durationMinutes,
      blankAttendanceRows: input.blankAttendanceRows ?? 0,
      executionStatus: input.executionStatus,
      notes: input.notes,
      createdAt: timestamp,
      updatedAt: timestamp,
      executedAt: input.executionStatus === "EXECUTED" ? timestamp : undefined,
      executedByUserId: input.executionStatus === "EXECUTED" ? actor.id : undefined,
      attendances: input.attendances.map((item) => ({
        id: crypto.randomUUID(),
        sessionId,
        personId: item.personId,
        attendanceStatus: input.executionStatus === "EXECUTED" ? item.attendanceStatus : "EXPECTED",
        result: input.executionStatus === "EXECUTED" ? item.result : "PENDING",
        notes: item.notes,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    };
    this.lastSequence.set(training.id, sequence);
    this.sessions.push(session);
    this.save();
    return structuredClone(session);
  }

  private async validateRelations(input: SessionInput, existing?: TrainingSession) {
    const training = await this.trainings.findById(input.trainingId);
    if (!training) throw new SessionRelationError("La formación asociada no existe");
    const ids = trainerIds(input);
    const names = externalNames(input);
    if (ids.length === 0 && names.length === 0) throw new SessionRelationError("La sesión requiere al menos un formador");
    if (training.originType === "INTERNAL" && names.length > 0) throw new SessionRelationError("Una formación interna no puede usar nombres manuales como formador; selecciona un formador cualificado interno o externo");
    const prior = new Set(existing?.trainerPersonIds ?? (existing?.trainerPersonId ? [existing.trainerPersonId] : []));
    for (const personId of ids) {
      const trainer = await this.people.findById(personId);
      if (!trainer || (!trainer.active && !prior.has(personId))) {
        throw new SessionRelationError("Todos los formadores seleccionados deben ser personas válidas y activas");
      }
    }
    const priorIds = new Set(existing?.attendances.map((item) => item.personId) ?? []);
    for (const personId of input.attendeePersonIds) {
      const person = await this.people.findById(personId);
      if (!person || (!person.active && !priorIds.has(personId))) throw new SessionRelationError("Todos los asistentes nuevos deben existir y estar activos");
    }
    return training;
  }

  async create(input: SessionInput, actor: CurrentUser) {
    if (!canCreateSession(actor)) throw new SessionAuthorizationError();
    const training = await this.validateRelations(input);
    const sequence = (this.lastSequence.get(training.id) ?? 0) + 1;
    const timestamp = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const session: TrainingSession = {
      id: sessionId, trainingId: training.id, code: formatSessionCode(training.code, sequence), plannedDate: input.plannedDate,
      trainerPersonIds: trainerIds(input), trainerPersonId: trainerIds(input)[0], externalTrainerNames: externalNames(input), externalTrainerName: externalNames(input)[0],
      blankAttendanceRows: input.blankAttendanceRows ?? 0, durationMinutes: input.durationMinutes, notes: input.notes,
      executionStatus: "PENDING", createdAt: timestamp, updatedAt: timestamp,
      attendances: input.attendeePersonIds.map((personId) => ({ id: crypto.randomUUID(), sessionId, personId, attendanceStatus: "EXPECTED", result: "PENDING", createdAt: timestamp, updatedAt: timestamp })),
    };
    await this.audit.append({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: session.id, action: "TRAINING_SESSION_CREATED", afterJson: session, contextJson: { trainingId: training.id, code: session.code } });
    this.lastSequence.set(training.id, sequence);
    this.sessions.push(session);
    this.save();
    return structuredClone(session);
  }

  async update(id: string, input: SessionInput, actor: CurrentUser) {
    const index = this.sessions.findIndex((session) => session.id === id);
    if (index < 0) return undefined;
    const existing = this.sessions[index];
    if (!canEditSession(actor, existing.executionStatus)) throw new SessionAuthorizationError();
    if (input.trainingId !== existing.trainingId) throw new SessionImmutableFieldError();
    const existingAttendeeIds = new Set(existing.attendances.map((item) => item.personId));
    const requestedAttendeeIds = new Set(input.attendeePersonIds);
    const closedSession = existing.executionStatus !== "PENDING";
    if (closedSession && (existingAttendeeIds.size !== requestedAttendeeIds.size || [...existingAttendeeIds].some((personId) => !requestedAttendeeIds.has(personId)))) {
      throw new SessionStateError("Los asistentes de una sesión cerrada no pueden añadirse ni eliminarse mediante la edición general");
    }
    await this.validateRelations(input, existing);
    const timestamp = new Date().toISOString();
    const byPerson = new Map(existing.attendances.map((item) => [item.personId, item]));
    const updated: TrainingSession = {
      ...existing, plannedDate: input.plannedDate, trainerPersonIds: trainerIds(input), trainerPersonId: trainerIds(input)[0],
      externalTrainerNames: externalNames(input), externalTrainerName: externalNames(input)[0],
      blankAttendanceRows: input.blankAttendanceRows ?? 0, durationMinutes: input.durationMinutes, notes: input.notes, updatedAt: timestamp,
      attendances: closedSession ? existing.attendances : input.attendeePersonIds.map((personId) => byPerson.get(personId) ?? ({ id: crypto.randomUUID(), sessionId: id, personId, attendanceStatus: "EXPECTED", result: "PENDING", createdAt: timestamp, updatedAt: timestamp } as Attendance)),
    };
    if (closedSession) await this.audit.append({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: id, action: "CLOSED_SESSION_CORRECTED", beforeJson: existing, afterJson: updated, contextJson: { previousStatus: existing.executionStatus } });
    else await this.audit.append({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: id, action: "TRAINING_SESSION_UPDATED", beforeJson: existing, afterJson: updated });
    this.sessions[index] = updated;
    this.save();
    return structuredClone(updated);
  }

  async finalize(id: string, input: FinalizeSessionInput, actor: CurrentUser) {
    if (!canCloseSession(actor)) throw new SessionAuthorizationError();
    const index = this.sessions.findIndex((session) => session.id === id);
    if (index < 0) return undefined;
    const existing = this.sessions[index];
    if (existing.executionStatus !== "PENDING") throw new SessionStateError();
    const training = await this.trainings.findById(existing.trainingId);
    if (!training) throw new SessionRelationError("La formación asociada no existe");
    if (training.originType === "INTERNAL" && !training.evaluationMethodId) throw new SessionRelationError("Debe definir el método de evaluación antes de finalizar una formación interna");
    if (training.originType === "INTERNAL" && !training.aptitudeCriterion) throw new SessionRelationError("Debe definir el criterio de aptitud antes de finalizar una formación interna");
    const overrides = new Map(input.attendances.map((item) => [item.personId, validateAttendanceCompletion(item)]));
    const expectedIds = new Set(existing.attendances.map((item) => item.personId));
    if ([...overrides.keys()].some((personId) => !expectedIds.has(personId))) throw new SessionRelationError("La asistencia contiene una persona no prevista");
    if (!input.initializeDefaults && overrides.size !== expectedIds.size) throw new SessionRelationError("Debe registrar la asistencia y el resultado de todas las personas");
    const timestamp = new Date().toISOString();
    const attendances = existing.attendances.map((item) => {
      const result = overrides.get(item.personId) ?? (input.initializeDefaults ? { personId: item.personId, attendanceStatus: "ATTENDED" as const, result: "PASS" as const } : undefined);
      if (!result) throw new SessionRelationError("Faltan resultados de asistencia");
      return { ...item, attendanceStatus: result.attendanceStatus, result: result.result, notes: result.notes, updatedAt: timestamp };
    });
    const updated: TrainingSession = { ...existing, executionDate: input.executionDate, executionStatus: "EXECUTED", nonExecutionReason: undefined, executedAt: timestamp, executedByUserId: actor.id, updatedAt: timestamp, attendances };
    await this.audit.append({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: id, action: "TRAINING_SESSION_EXECUTED", beforeJson: existing, afterJson: updated, contextJson: { executionDate: input.executionDate } });
    this.sessions[index] = updated;
    this.save();
    return structuredClone(updated);
  }
  async reopen(id: string, reason: string, actor: CurrentUser) {
    if (!canReopenSession(actor)) throw new SessionAuthorizationError();
    const index = this.sessions.findIndex((session) => session.id === id);
    if (index < 0) return undefined;
    const existing = this.sessions[index];
    if (existing.executionStatus === "PENDING") throw new SessionStateError("La sesión ya está abierta");
    const training = await this.trainings.findById(existing.trainingId);
    if (training?.closedAt) throw new SessionStateError("La formación está cerrada documentalmente. Reabre primero la formación.");
    if (!reason.trim()) throw new SessionStateError("El motivo de reapertura es obligatorio");
    const timestamp = new Date().toISOString();
    const updated: TrainingSession = {
      ...existing,
      executionStatus: "PENDING",
      executionDate: undefined,
      nonExecutionReason: undefined,
      executedAt: undefined,
      executedByUserId: undefined,
      updatedAt: timestamp,
      attendances: existing.attendances.map((item) => ({ ...item, attendanceStatus: "EXPECTED", result: "PENDING", updatedAt: timestamp })),
    };
    await this.audit.append({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: id, action: "TRAINING_SESSION_REOPENED", beforeJson: existing, afterJson: updated, contextJson: { reason: reason.trim() } });
    this.sessions[index] = updated;
    this.save();
    return structuredClone(updated);
  }

  async markNotExecuted(id: string, input: NotExecutedInput, actor: CurrentUser) {
    if (!canCloseSession(actor)) throw new SessionAuthorizationError();
    const index = this.sessions.findIndex((session) => session.id === id);
    if (index < 0) return undefined;
    const existing = this.sessions[index];
    if (existing.executionStatus !== "PENDING") throw new SessionStateError();
    const timestamp = new Date().toISOString();
    const updated: TrainingSession = { ...existing, executionStatus: "NOT_EXECUTED", nonExecutionReason: input.reason, executionDate: undefined, executedAt: undefined, executedByUserId: undefined, updatedAt: timestamp };
    await this.audit.append({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: id, action: "TRAINING_SESSION_NOT_EXECUTED", beforeJson: existing, afterJson: updated, contextJson: { reason: input.reason } });
    this.sessions[index] = updated;
    this.save();
    return structuredClone(updated);
  }
}
