import { PrismaClient, type EvaluationMethod, type Modality, type PlanningType, type Prisma, type Training as PrismaTraining, type TrainingOriginType, type TrainingType } from "@prisma/client";
import { auditData } from "@/administration/prisma-audit-repository";
import type { TrainingCatalogs } from "@/domain/training-catalogs";
import { formatTrainingCode, matchesTrainingFilters, type Training, type TrainingFilters, type TrainingInput } from "@/domain/training";
import { TrainingCatalogReferenceError, TrainingClosureError, TrainingConflictError, TrainingYearImmutableError, type TrainingRepository } from "@/server/training-repository";

type TrainingRow = PrismaTraining & {
  plannedTrainerLinks: Array<{ personId: string }>;
  targetDepartmentLinks: Array<{ departmentId: string }>;
};

const trainingInclude = {
  plannedTrainerLinks: { select: { personId: true } },
  targetDepartmentLinks: { select: { departmentId: true } },
} satisfies Prisma.TrainingInclude;

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

const toTraining = (training: TrainingRow): Training => {
  const plannedTrainerPersonIds = training.plannedTrainerLinks.map((item) => item.personId);
  const externalTrainerNames = training.plannedExternalTrainerNames;
  return {
    id: training.id,
    code: training.code,
    year: training.year,
    name: training.name,
    planningType: training.planningType as Training["planningType"],
    trainingTypeId: training.trainingTypeId ?? undefined,
    reason: training.reason ?? undefined,
    isGmp: training.isGmp,
    originType: training.originType as Training["originType"],
    modalityId: training.modalityId ?? undefined,
    plannedDurationMinutes: training.plannedDurationMinutes ?? undefined,
    materialReference: training.materialReference ?? undefined,
    content: training.content ?? undefined,
    targetGroup: training.targetGroup ?? undefined,
    targetDepartmentIds: training.targetDepartmentLinks.map((item) => item.departmentId),
    plannedTrainerPersonIds,
    externalTrainerNames,
    plannedTrainerPersonId: plannedTrainerPersonIds[0],
    externalTrainerName: externalTrainerNames[0],
    evaluationMethodId: training.evaluationMethodId ?? undefined,
    aptitudeCriterion: training.aptitudeCriterion ?? undefined,
    frequencyMonths: training.frequencyMonths ?? undefined,
    notes: training.notes ?? undefined,
    createdByUserId: training.createdByUserId,
    createdAt: training.createdAt.toISOString(),
    updatedAt: training.updatedAt.toISOString(),
    closedAt: training.closedAt?.toISOString(),
    closedByUserId: training.closedByUserId ?? undefined,
  };
};

const toData = (input: TrainingInput) => ({
  year: input.year,
  name: input.name,
  planningType: input.planningType as PlanningType,
  trainingTypeId: input.trainingTypeId ?? null,
  reason: input.reason ?? null,
  isGmp: input.isGmp,
  originType: input.originType as TrainingOriginType,
  modalityId: input.modalityId ?? null,
  plannedDurationMinutes: input.plannedDurationMinutes ?? null,
  materialReference: input.materialReference ?? null,
  content: input.content ?? null,
  targetGroup: input.targetGroup ?? null,
  plannedExternalTrainerNames: input.originType === "EXTERNAL"
    ? unique(input.externalTrainerNames ?? (input.externalTrainerName ? [input.externalTrainerName] : []))
    : [],
  evaluationMethodId: input.evaluationMethodId ?? null,
  aptitudeCriterion: input.aptitudeCriterion ?? null,
  frequencyMonths: input.frequencyMonths ?? null,
  notes: input.notes ?? null,
});

const catalogItem = (item: TrainingType | Modality | EvaluationMethod) => ({ id: item.id, code: item.code, name: item.name, active: item.active });

export class PrismaTrainingRepository implements TrainingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filters: TrainingFilters = {}) {
    const where: Prisma.TrainingWhereInput = {
      year: filters.year,
      planningType: filters.planningType as PlanningType | undefined,
      isGmp: filters.isGmp,
      trainingTypeId: filters.trainingTypeId,
      originType: filters.originType as TrainingOriginType | undefined,
      ...(filters.search ? { OR: [
        { name: { contains: filters.search, mode: "insensitive" as const } },
        { code: { contains: filters.search, mode: "insensitive" as const } },
      ] } : {}),
      ...(filters.departmentId ? { targetDepartmentLinks: { some: { departmentId: filters.departmentId } } } : {}),
      ...(filters.trainerPersonId ? { plannedTrainerLinks: { some: { personId: filters.trainerPersonId } } } : {}),
      ...(filters.externalTrainerName ? { plannedExternalTrainerNames: { has: filters.externalTrainerName } } : {}),
    };
    const trainings = await this.prisma.training.findMany({
      where,
      include: trainingInclude,
      orderBy: [{ year: "desc" }, { code: "desc" }],
    });
    const mapped = trainings.map((item) => toTraining(item as TrainingRow));
    return filters.trainer ? mapped.filter((item) => matchesTrainingFilters(item, { trainer: filters.trainer })) : mapped;
  }

  async findById(id: string) {
    const training = await this.prisma.training.findUnique({ where: { id }, include: trainingInclude });
    return training ? toTraining(training as TrainingRow) : undefined;
  }

  async findByIds(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.prisma.training.findMany({ where: { id: { in: ids } }, include: trainingInclude });
    return rows.map((training) => toTraining(training as TrainingRow));
  }

  private async validateReferences(input: TrainingInput, existing: Training | undefined, client: PrismaClient | Prisma.TransactionClient) {
    const [trainingType, modality, evaluationMethod] = await Promise.all([
      input.trainingTypeId ? client.trainingType.findUnique({ where: { id: input.trainingTypeId } }) : undefined,
      input.modalityId ? client.modality.findUnique({ where: { id: input.modalityId } }) : undefined,
      input.evaluationMethodId ? client.evaluationMethod.findUnique({ where: { id: input.evaluationMethodId } }) : undefined,
    ]);
    const checks = [
      ["tipo de formación", input.trainingTypeId, existing?.trainingTypeId, trainingType],
      ["modalidad", input.modalityId, existing?.modalityId, modality],
      ["método de evaluación", input.evaluationMethodId, existing?.evaluationMethodId, evaluationMethod],
    ] as const;
    for (const [label, requestedId, currentId, item] of checks) {
      if (requestedId && (!item || (!item.active && requestedId !== currentId))) {
        throw new TrainingCatalogReferenceError(`El ${label} seleccionado no existe o está inactivo`);
      }
    }

    const departmentIds = unique(input.targetDepartmentIds ?? []);
    if (departmentIds.length) {
      const departments = await client.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, active: true } });
      const prior = new Set(existing?.targetDepartmentIds ?? []);
      if (departments.length !== departmentIds.length || departments.some((item) => !item.active && !prior.has(item.id))) {
        throw new TrainingCatalogReferenceError("Todos los departamentos destinatarios deben existir y estar activos");
      }
    }

    const trainerIds = unique(input.plannedTrainerPersonIds ?? (input.plannedTrainerPersonId ? [input.plannedTrainerPersonId] : []));
    if (trainerIds.length) {
      const trainers = await client.person.findMany({ where: { id: { in: trainerIds } }, select: { id: true, active: true } });
      const prior = new Set(existing?.plannedTrainerPersonIds ?? (existing?.plannedTrainerPersonId ? [existing.plannedTrainerPersonId] : []));
      if (trainers.length !== trainerIds.length || trainers.some((item) => !item.active && !prior.has(item.id))) {
        throw new TrainingCatalogReferenceError("Todos los formadores deben existir y estar activos");
      }
    }
  }

  private relationData(input: TrainingInput) {
    const trainerIds = unique(input.plannedTrainerPersonIds ?? (input.plannedTrainerPersonId ? [input.plannedTrainerPersonId] : []));
    const departmentIds = unique(input.targetDepartmentIds ?? []);
    return { trainerIds, departmentIds };
  }

  async create(input: TrainingInput, createdByUserId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.validateReferences(input, undefined, transaction);
      const sequence = await transaction.trainingCodeSequence.upsert({
        where: { year: input.year },
        create: { year: input.year, lastValue: 1 },
        update: { lastValue: { increment: 1 } },
      });
      const { trainerIds, departmentIds } = this.relationData(input);
      const training = await transaction.training.create({
        data: {
          ...toData(input),
          code: formatTrainingCode(input.year, sequence.lastValue),
          createdByUserId,
          plannedTrainerLinks: { create: trainerIds.map((personId) => ({ personId })) },
          targetDepartmentLinks: { create: departmentIds.map((departmentId) => ({ departmentId })) },
        },
        include: trainingInclude,
      });
      const created = toTraining(training as TrainingRow);
      await transaction.auditEvent.create({ data: auditData({
        actorUserId: createdByUserId,
        entityType: "TRAINING",
        entityId: created.id,
        action: "TRAINING_CREATED",
        afterJson: created,
        contextJson: { code: created.code },
      }) });
      return created;
    });
  }

  async update(id: string, input: TrainingInput, updatedByUserId: string, expectedUpdatedAt?: string) {
    return this.prisma.$transaction(async (transaction) => {
      const stored = await transaction.training.findUnique({ where: { id }, include: trainingInclude });
      if (!stored) return undefined;
      const existing = toTraining(stored as TrainingRow);
      if (expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) throw new TrainingConflictError();
      if (input.year !== existing.year) throw new TrainingYearImmutableError();
      await this.validateReferences(input, existing, transaction);
      const { trainerIds, departmentIds } = this.relationData(input);
      const expectedTimestamp = expectedUpdatedAt ? new Date(expectedUpdatedAt) : stored.updatedAt;
      const changed = await transaction.training.updateMany({
        where: { id, updatedAt: expectedTimestamp },
        data: toData(input),
      });
      if (changed.count !== 1) throw new TrainingConflictError();
      await transaction.trainingPlannedTrainer.deleteMany({ where: { trainingId: id } });
      if (trainerIds.length) await transaction.trainingPlannedTrainer.createMany({ data: trainerIds.map((personId) => ({ trainingId: id, personId })), skipDuplicates: true });
      await transaction.trainingTargetDepartment.deleteMany({ where: { trainingId: id } });
      if (departmentIds.length) await transaction.trainingTargetDepartment.createMany({ data: departmentIds.map((departmentId) => ({ trainingId: id, departmentId })), skipDuplicates: true });
      const updated = toTraining(await transaction.training.findUniqueOrThrow({ where: { id }, include: trainingInclude }) as TrainingRow);
      await transaction.auditEvent.create({ data: auditData({
        actorUserId: updatedByUserId,
        entityType: "TRAINING",
        entityId: id,
        action: "TRAINING_UPDATED",
        beforeJson: existing,
        afterJson: updated,
        contextJson: { code: existing.code },
      }) });
      return updated;
    });
  }

  async closeDocumentary(id: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.training.findUnique({ where: { id }, include: trainingInclude });
      if (!stored) return undefined;
      if (stored.closedAt) throw new TrainingClosureError("La formación ya está cerrada");
      const before = toTraining(stored as TrainingRow);
      const row = await tx.training.update({ where: { id }, data: { closedAt: new Date(), closedByUserId: actorUserId }, include: trainingInclude });
      const after = toTraining(row as TrainingRow);
      await tx.auditEvent.create({ data: auditData({ actorUserId, entityType: "TRAINING", entityId: id, action: "TRAINING_DOCUMENTARY_CLOSED", beforeJson: before, afterJson: after }) });
      return after;
    });
  }

  async reopenDocumentary(id: string, reason: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.training.findUnique({ where: { id }, include: trainingInclude });
      if (!stored) return undefined;
      if (!stored.closedAt) throw new TrainingClosureError("La formación ya está abierta");
      const before = toTraining(stored as TrainingRow);
      const row = await tx.training.update({ where: { id }, data: { closedAt: null, closedByUserId: null }, include: trainingInclude });
      const after = toTraining(row as TrainingRow);
      await tx.auditEvent.create({ data: auditData({ actorUserId, entityType: "TRAINING", entityId: id, action: "TRAINING_DOCUMENTARY_REOPENED", beforeJson: before, afterJson: after, contextJson: { reason } }) });
      return after;
    });
  }

  async listCatalogs(options?: { includeInactive?: boolean }): Promise<TrainingCatalogs> {
    const where = options?.includeInactive ? undefined : { active: true };
    const [trainingTypes, modalities, evaluationMethods] = await Promise.all([
      this.prisma.trainingType.findMany({ where, orderBy: { name: "asc" } }),
      this.prisma.modality.findMany({ where, orderBy: { name: "asc" } }),
      this.prisma.evaluationMethod.findMany({ where, orderBy: { name: "asc" } }),
    ]);
    return { trainingTypes: trainingTypes.map(catalogItem), modalities: modalities.map(catalogItem), evaluationMethods: evaluationMethods.map(catalogItem) };
  }
}
