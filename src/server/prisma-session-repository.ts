import { PrismaClient, type Attendance as PrismaAttendance, type Prisma, type TrainingSession as PrismaTrainingSession } from "@prisma/client";
import type { CurrentUser } from "@/auth/current-user";
import { canCloseSession, canCreateSession, canEditSession, canReopenSession } from "@/auth/current-user";
import { auditData } from "@/administration/prisma-audit-repository";
import { calculateTrainingStatus, formatSessionCode, validateAttendanceCompletion, type Attendance, type FinalizeSessionInput, type NotExecutedInput, type SessionInput, type TrainingSession } from "@/domain/training-session";
import { SessionAuthorizationError, SessionImmutableFieldError, SessionRelationError, SessionStateError, type HistoricalSessionImportInput, type SessionRepository } from "@/server/session-repository";

type SessionRow = PrismaTrainingSession & { attendances: PrismaAttendance[]; trainerLinks: Array<{ personId: string }> };
const sessionInclude = { attendances: true, trainerLinks: { select: { personId: true } } } satisfies Prisma.TrainingSessionInclude;
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const trainerIds = (input: Pick<SessionInput, "trainerPersonIds" | "trainerPersonId">) => unique(input.trainerPersonIds ?? (input.trainerPersonId ? [input.trainerPersonId] : []));
const externalNames = (input: Pick<SessionInput, "externalTrainerNames" | "externalTrainerName">) => unique(input.externalTrainerNames ?? (input.externalTrainerName ? [input.externalTrainerName] : []));

const toAttendance = (item: PrismaAttendance): Attendance => ({
  id: item.id, sessionId: item.sessionId, personId: item.personId,
  attendanceStatus: item.attendanceStatus as Attendance["attendanceStatus"], result: item.result as Attendance["result"],
  notes: item.notes ?? undefined, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
});
const toSession = (item: SessionRow): TrainingSession => {
  const ids = item.trainerLinks.map((link) => link.personId);
  const names = item.externalTrainerNames;
  return {
    id: item.id, trainingId: item.trainingId, code: item.code, plannedDate: dateOnly(item.plannedDate), executionDate: item.executionDate ? dateOnly(item.executionDate) : undefined,
    trainerPersonIds: ids, trainerPersonId: ids[0], externalTrainerNames: names, externalTrainerName: names[0],
    blankAttendanceRows: item.blankAttendanceRows, durationMinutes: item.durationMinutes,
    executionStatus: item.executionStatus as TrainingSession["executionStatus"], nonExecutionReason: item.nonExecutionReason ?? undefined, notes: item.notes ?? undefined,
    createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), executedAt: item.executedAt?.toISOString(), executedByUserId: item.executedByUserId ?? undefined,
    attendances: item.attendances.map(toAttendance),
  };
};
const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listAll() {
    return (await this.prisma.trainingSession.findMany({ include: sessionInclude })).map((item) => toSession(item as SessionRow));
  }
  async listByTraining(trainingId: string) {
    return (await this.prisma.trainingSession.findMany({ where: { trainingId }, include: sessionInclude, orderBy: { code: "asc" } })).map((item) => toSession(item as SessionRow));
  }
  async listByTrainingIds(trainingIds: string[]) {
    if (!trainingIds.length) return [];
    return (await this.prisma.trainingSession.findMany({ where: { trainingId: { in: trainingIds } }, include: sessionInclude, orderBy: { code: "asc" } })).map((item) => toSession(item as SessionRow));
  }
  async listByPerson(personId: string) {
    return (await this.prisma.trainingSession.findMany({ where: { attendances: { some: { personId } } }, include: sessionInclude })).map((item) => toSession(item as SessionRow));
  }
  async findById(id: string) {
    const item = await this.prisma.trainingSession.findUnique({ where: { id }, include: sessionInclude });
    return item ? toSession(item as SessionRow) : undefined;
  }
  async trainingStatus(trainingId: string) { return calculateTrainingStatus(await this.listByTraining(trainingId)); }

  async importHistorical(input: HistoricalSessionImportInput, actor: CurrentUser) {
    if (actor.role !== "ADMIN") throw new SessionAuthorizationError();
    return this.prisma.$transaction(async (transaction) => {
      const training = await transaction.training.findUnique({ where: { id: input.trainingId } });
      if (!training) throw new SessionRelationError("La formación asociada no existe");
      const sequence = await transaction.sessionCodeSequence.upsert({ where: { trainingId: training.id }, create: { trainingId: training.id, lastValue: 1 }, update: { lastValue: { increment: 1 } } });
      const ids = unique(input.trainerPersonIds ?? (input.trainerPersonId ? [input.trainerPersonId] : []));
      const names = unique(input.externalTrainerNames ?? (input.externalTrainerName ? [input.externalTrainerName] : []));
      const item = await transaction.trainingSession.create({
        data: {
          trainingId: training.id,
          code: formatSessionCode(training.code, sequence.lastValue),
          plannedDate: asDate(input.plannedDate),
          executionDate: input.executionDate ? asDate(input.executionDate) : null,
          externalTrainerNames: names,
          blankAttendanceRows: input.blankAttendanceRows ?? 0,
          durationMinutes: input.durationMinutes,
          executionStatus: input.executionStatus,
          notes: input.notes ?? null,
          executedAt: input.executionStatus === "EXECUTED" ? new Date() : null,
          executedByUserId: input.executionStatus === "EXECUTED" ? actor.id : null,
          trainerLinks: { create: ids.map((personId) => ({ personId })) },
          attendances: { create: input.attendances.map((attendance) => ({
            personId: attendance.personId,
            attendanceStatus: input.executionStatus === "EXECUTED" ? attendance.attendanceStatus : "EXPECTED",
            result: input.executionStatus === "EXECUTED" ? attendance.result : "PENDING",
            notes: attendance.notes ?? null,
          })) },
        },
        include: sessionInclude,
      });
      return toSession(item as SessionRow);
    });
  }

  private async validateRelations(input: SessionInput, existing?: TrainingSession, client: PrismaClient | Prisma.TransactionClient = this.prisma) {
    const training = await client.training.findUnique({ where: { id: input.trainingId } });
    if (!training) throw new SessionRelationError("La formación asociada no existe");
    const ids = trainerIds(input);
    const names = externalNames(input);
    if (ids.length === 0 && names.length === 0) throw new SessionRelationError("La sesión requiere al menos un formador");
    if (training.originType === "INTERNAL" && names.length > 0) throw new SessionRelationError("Una formación interna no puede usar nombres manuales como formador; selecciona un formador cualificado interno o externo");
    if (ids.length) {
      const trainers = await client.person.findMany({ where: { id: { in: ids } }, select: { id: true, active: true, personType: true } });
      const prior = new Set(existing?.trainerPersonIds ?? (existing?.trainerPersonId ? [existing.trainerPersonId] : []));
      if (trainers.length !== ids.length || trainers.some((item) => !item.active && !prior.has(item.id))) {
        throw new SessionRelationError("Todos los formadores seleccionados deben ser personas válidas y activas");
      }
    }
    const people = await client.person.findMany({ where: { id: { in: input.attendeePersonIds } }, select: { id: true, active: true } });
    const priorIds = new Set(existing?.attendances.map((item) => item.personId) ?? []);
    if (people.length !== input.attendeePersonIds.length || people.some((person) => !person.active && !priorIds.has(person.id))) throw new SessionRelationError("Todos los asistentes nuevos deben existir y estar activos");
    return training;
  }

  async create(input: SessionInput, actor: CurrentUser) {
    if (!canCreateSession(actor)) throw new SessionAuthorizationError();
    const training = await this.validateRelations(input);
    return this.prisma.$transaction(async (transaction) => {
      const sequence = await transaction.sessionCodeSequence.upsert({ where: { trainingId: training.id }, create: { trainingId: training.id, lastValue: 1 }, update: { lastValue: { increment: 1 } } });
      const ids = trainerIds(input);
      const item = await transaction.trainingSession.create({
        data: {
          trainingId: training.id, code: formatSessionCode(training.code, sequence.lastValue), plannedDate: asDate(input.plannedDate),
          externalTrainerNames: externalNames(input), blankAttendanceRows: input.blankAttendanceRows ?? 0, durationMinutes: input.durationMinutes, notes: input.notes ?? null,
          trainerLinks: { create: ids.map((personId) => ({ personId })) },
          attendances: { create: input.attendeePersonIds.map((personId) => ({ personId })) },
        }, include: sessionInclude,
      });
      const result = toSession(item as SessionRow);
      await transaction.auditEvent.create({ data: auditData({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: item.id, action: "TRAINING_SESSION_CREATED", afterJson: result, contextJson: { trainingId: training.id, code: item.code } }) });
      return result;
    });
  }

  async update(id: string, input: SessionInput, actor: CurrentUser) {
    return this.prisma.$transaction(async (transaction) => {
      const stored = await transaction.trainingSession.findUnique({ where: { id }, include: sessionInclude });
      if (!stored) return undefined;
      const existing = toSession(stored as SessionRow);
      if (!canEditSession(actor, existing.executionStatus)) throw new SessionAuthorizationError();
      if (input.trainingId !== existing.trainingId) throw new SessionImmutableFieldError();
      const existingAttendeeIds = new Set(existing.attendances.map((item) => item.personId));
      const requestedAttendeeIds = new Set(input.attendeePersonIds);
      const closedSession = existing.executionStatus !== "PENDING";
      if (closedSession && (existingAttendeeIds.size !== requestedAttendeeIds.size || [...existingAttendeeIds].some((personId) => !requestedAttendeeIds.has(personId)))) {
        throw new SessionStateError("Los asistentes de una sesión cerrada no pueden añadirse ni eliminarse mediante la edición general");
      }
      await this.validateRelations(input, existing, transaction);
      if (!closedSession) {
        await transaction.attendance.deleteMany({ where: { sessionId: id, personId: { notIn: input.attendeePersonIds } } });
        for (const personId of requestedAttendeeIds) if (!existingAttendeeIds.has(personId)) await transaction.attendance.create({ data: { sessionId: id, personId } });
      }
      const updated = await transaction.trainingSession.updateMany({ where: { id, executionStatus: stored.executionStatus, updatedAt: stored.updatedAt }, data: {
        plannedDate: asDate(input.plannedDate), externalTrainerNames: externalNames(input), blankAttendanceRows: input.blankAttendanceRows ?? 0, durationMinutes: input.durationMinutes, notes: input.notes ?? null,
      } });
      if (updated.count !== 1) throw new SessionStateError("La sesión ha cambiado de estado o contenido durante la edición");
      await transaction.trainingSessionTrainer.deleteMany({ where: { sessionId: id } });
      const ids = trainerIds(input);
      if (ids.length) await transaction.trainingSessionTrainer.createMany({ data: ids.map((personId) => ({ sessionId: id, personId })), skipDuplicates: true });
      const item = await transaction.trainingSession.findUniqueOrThrow({ where: { id }, include: sessionInclude });
      const result = toSession(item as SessionRow);
      if (closedSession) await transaction.auditEvent.create({ data: auditData({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: id, action: "CLOSED_SESSION_CORRECTED", beforeJson: existing, afterJson: result, contextJson: { previousStatus: existing.executionStatus } }) });
      else await transaction.auditEvent.create({ data: auditData({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: id, action: "TRAINING_SESSION_UPDATED", beforeJson: existing, afterJson: result }) });
      return result;
    });
  }

  async finalize(id: string, input: FinalizeSessionInput, actor: CurrentUser) {
    if (!canCloseSession(actor)) throw new SessionAuthorizationError();
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.trainingSession.findUnique({ where: { id }, include: { ...sessionInclude, training: true } });
      if (!existing) return undefined;
      if (existing.executionStatus !== "PENDING") throw new SessionStateError();
      if (existing.training.originType === "INTERNAL" && !existing.training.evaluationMethodId) throw new SessionRelationError("Debe definir el método de evaluación antes de finalizar una formación interna");
      if (existing.training.originType === "INTERNAL" && !existing.training.aptitudeCriterion) throw new SessionRelationError("Debe definir el criterio de aptitud antes de finalizar una formación interna");
      const overrides = new Map(input.attendances.map((item) => [item.personId, validateAttendanceCompletion(item)]));
      const expectedIds = new Set(existing.attendances.map((item) => item.personId));
      if ([...overrides.keys()].some((personId) => !expectedIds.has(personId))) throw new SessionRelationError("La asistencia contiene una persona no prevista");
      if (!input.initializeDefaults && overrides.size !== expectedIds.size) throw new SessionRelationError("Debe registrar la asistencia y el resultado de todas las personas");
      const transition = await transaction.trainingSession.updateMany({
        where: { id, executionStatus: "PENDING", updatedAt: existing.updatedAt },
        data: { executionDate: asDate(input.executionDate), executionStatus: "EXECUTED", nonExecutionReason: null, executedAt: new Date(), executedByUserId: actor.id },
      });
      if (transition.count !== 1) throw new SessionStateError("La sesión ya no está pendiente");
      for (const current of existing.attendances) {
        const result = overrides.get(current.personId) ?? (input.initializeDefaults ? { attendanceStatus: "ATTENDED" as const, result: "PASS" as const, notes: undefined } : undefined);
        if (!result) throw new SessionRelationError("Faltan resultados de asistencia");
        await transaction.attendance.update({ where: { id: current.id }, data: { attendanceStatus: result.attendanceStatus, result: result.result, notes: result.notes ?? null } });
      }
      const item = await transaction.trainingSession.findUniqueOrThrow({ where: { id }, include: sessionInclude });
      const result = toSession(item as SessionRow);
      await transaction.auditEvent.create({ data: auditData({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: id, action: "TRAINING_SESSION_EXECUTED", beforeJson: toSession(existing as SessionRow), afterJson: result, contextJson: { executionDate: input.executionDate } }) });
      return result;
    });
  }
  async reopen(id: string, reason: string, actor: CurrentUser) {
    if (!canReopenSession(actor)) throw new SessionAuthorizationError();
    if (!reason.trim()) throw new SessionStateError("El motivo de reapertura es obligatorio");
    return this.prisma.$transaction(async (transaction) => {
      const stored = await transaction.trainingSession.findUnique({ where: { id }, include: { ...sessionInclude, training: { select: { closedAt: true } } } });
      if (!stored) return undefined;
      if (stored.executionStatus === "PENDING") throw new SessionStateError("La sesión ya está abierta");
      if (stored.training.closedAt) throw new SessionStateError("La formación está cerrada documentalmente. Reabre primero la formación.");
      const before = toSession(stored as SessionRow);
      const transition = await transaction.trainingSession.updateMany({
        where: { id, executionStatus: stored.executionStatus, updatedAt: stored.updatedAt },
        data: { executionStatus: "PENDING", executionDate: null, nonExecutionReason: null, executedAt: null, executedByUserId: null },
      });
      if (transition.count !== 1) throw new SessionStateError("La sesión ha cambiado durante la reapertura");
      await transaction.attendance.updateMany({ where: { sessionId: id }, data: { attendanceStatus: "EXPECTED", result: "PENDING" } });
      const row = await transaction.trainingSession.findUniqueOrThrow({ where: { id }, include: sessionInclude });
      const after = toSession(row as SessionRow);
      await transaction.auditEvent.create({ data: auditData({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: id, action: "TRAINING_SESSION_REOPENED", beforeJson: before, afterJson: after, contextJson: { reason: reason.trim() } }) });
      return after;
    });
  }

  async markNotExecuted(id: string, input: NotExecutedInput, actor: CurrentUser) {
    if (!canCloseSession(actor)) throw new SessionAuthorizationError();
    return this.prisma.$transaction(async (transaction) => {
      const beforeRow = await transaction.trainingSession.findUnique({ where: { id }, include: sessionInclude });
      if (!beforeRow) return undefined;
      const transition = await transaction.trainingSession.updateMany({
        where: { id, executionStatus: "PENDING" },
        data: { executionStatus: "NOT_EXECUTED", nonExecutionReason: input.reason, executionDate: null, executedAt: null, executedByUserId: null },
      });
      if (transition.count !== 1) {
        const existing = await transaction.trainingSession.findUnique({ where: { id }, select: { id: true } });
        if (!existing) return undefined;
        throw new SessionStateError("La sesión ya no está pendiente");
      }
      const item = await transaction.trainingSession.findUniqueOrThrow({ where: { id }, include: sessionInclude });
      const result = toSession(item as SessionRow);
      await transaction.auditEvent.create({ data: auditData({ actorUserId: actor.id, entityType: "TRAINING_SESSION", entityId: id, action: "TRAINING_SESSION_NOT_EXECUTED", beforeJson: toSession(beforeRow as SessionRow), afterJson: result, contextJson: { reason: input.reason } }) });
      return result;
    });
  }
}
