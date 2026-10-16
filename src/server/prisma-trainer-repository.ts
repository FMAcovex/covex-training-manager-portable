import { Prisma, PrismaClient, type PersonType } from "@prisma/client";
import { auditData } from "@/administration/prisma-audit-repository";
import type { PersonInput } from "@/domain/person";
import { normalizeTrainerSubject, qualificationIsCurrent, type TrainerDocumentContent, type TrainerDocumentInput, type TrainerDocumentMeta, type TrainerQualification, type TrainerQualificationInput } from "@/domain/trainer";
import { TrainerConflictError, TrainerReferenceError, type TrainerListOptions, type TrainerRepository } from "@/server/trainer-repository";

const asDate = (value: string) => new Date(value + "T00:00:00.000Z");
const dateText = (value: Date) => value.toISOString().slice(0, 10);

const personSelect = {
  id: true,
  fullName: true,
  personType: true,
  company: true,
  departmentId: true,
  jobTitle: true,
  active: true,
} as const;

type QualificationRow = Prisma.TrainerQualificationGetPayload<{ include: { person: { select: typeof personSelect } } }>;

function toQualification(row: QualificationRow): TrainerQualification {
  const qualifiedFrom = dateText(row.qualifiedFrom);
  const qualifiedTo = row.qualifiedTo ? dateText(row.qualifiedTo) : undefined;
  return {
    id: row.id,
    personId: row.personId,
    authorizedSubject: row.authorizedSubject,
    evidence: row.evidence,
    qualifiedFrom,
    qualifiedTo,
    person: {
      ...row.person,
      personType: row.person.personType as TrainerQualification["person"]["personType"],
      company: row.person.company ?? undefined,
      departmentId: row.person.departmentId ?? undefined,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    annulledAt: row.annulledAt?.toISOString(),
    annulledByUserId: row.annulledByUserId ?? undefined,
    annulmentReason: row.annulmentReason ?? undefined,
    current: qualificationIsCurrent({ qualifiedFrom, qualifiedTo, annulledAt: row.annulledAt?.toISOString() }),
  };
}

function toDocumentMeta(row: { id: string; personId: string; fileName: string; mimeType: string; sizeBytes: number; uploadedByUserId: string; createdAt: Date }): TrainerDocumentMeta {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export class PrismaTrainerRepository implements TrainerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(options: TrainerListOptions = {}) {
    const today = asDate(new Date().toISOString().slice(0, 10));
    const rows = await this.prisma.trainerQualification.findMany({
      where: {
        person: options.personType ? { personType: options.personType as PersonType } : undefined,
        ...(!options.includeAnnulled ? { annulledAt: null } : {}),
        ...(options.currentOnly ? { qualifiedFrom: { lte: today }, annulledAt: null, OR: [{ qualifiedTo: null }, { qualifiedTo: { gt: today } }] } : {}),
      },
      include: { person: { select: personSelect } },
      orderBy: [{ person: { fullName: "asc" } }, { authorizedSubject: "asc" }],
    });
    return rows.map((row) => toQualification(row as QualificationRow));
  }

  async findQualificationById(id: string) {
    const row = await this.prisma.trainerQualification.findUnique({ where: { id }, include: { person: { select: personSelect } } });
    return row ? toQualification(row as QualificationRow) : undefined;
  }

  private async validatePerson(personId: string, client: PrismaClient | Prisma.TransactionClient, requireActive = true) {
    const person = await client.person.findUnique({ where: { id: personId }, select: { id: true, active: true } });
    if (!person) throw new TrainerReferenceError("La persona seleccionada no existe");
    if (requireActive && !person.active) throw new TrainerReferenceError("No se puede crear una nueva cualificación para una persona inactiva");
  }

  async createQualification(input: TrainerQualificationInput, actorUserId: string) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await this.validatePerson(input.personId, transaction);
        const row = await transaction.trainerQualification.create({
          data: { personId: input.personId, authorizedSubject: input.authorizedSubject, authorizedSubjectNormalized: normalizeTrainerSubject(input.authorizedSubject), evidence: input.evidence, qualifiedFrom: asDate(input.qualifiedFrom), qualifiedTo: input.qualifiedTo ? asDate(input.qualifiedTo) : null },
          include: { person: { select: personSelect } },
        });
        await transaction.auditEvent.create({ data: auditData({ actorUserId, entityType: "TRAINER_QUALIFICATION", entityId: row.id, action: "TRAINER_QUALIFICATION_CREATED", afterJson: toQualification(row as QualificationRow) }) });
        return toQualification(row as QualificationRow);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new TrainerConflictError("Ya existe una cualificación para ese formador, materia y fecha de alta");
      throw error;
    }
  }

  async createQualifiedTrainer(personInput: PersonInput, qualificationInput: Omit<TrainerQualificationInput, "personId">, actorUserId: string) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (personInput.departmentId) {
          const department = await transaction.department.findUnique({ where: { id: personInput.departmentId } });
          if (!department || !department.active) throw new TrainerReferenceError("El departamento seleccionado no existe o está inactivo");
        }
        const person = await transaction.person.create({
          data: {
            fullName: personInput.fullName,
            employeeCode: personInput.employeeCode ?? null,
            personType: personInput.personType as PersonType,
            company: personInput.company ?? null,
            departmentId: personInput.departmentId ?? null,
            jobTitle: personInput.jobTitle,
            notes: personInput.notes ?? null,
          },
        });
        const row = await transaction.trainerQualification.create({
          data: {
            personId: person.id,
            authorizedSubject: qualificationInput.authorizedSubject,
            authorizedSubjectNormalized: normalizeTrainerSubject(qualificationInput.authorizedSubject),
            evidence: qualificationInput.evidence,
            qualifiedFrom: asDate(qualificationInput.qualifiedFrom),
            qualifiedTo: qualificationInput.qualifiedTo ? asDate(qualificationInput.qualifiedTo) : null,
          },
          include: { person: { select: personSelect } },
        });
        await transaction.auditEvent.create({
          data: auditData({
            actorUserId,
            entityType: "TRAINER_QUALIFICATION",
            entityId: row.id,
            action: "TRAINER_QUALIFICATION_CREATED",
            afterJson: toQualification(row as QualificationRow),
            contextJson: { personCreatedWithQualification: true },
          }),
        });
        return toQualification(row as QualificationRow);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new TrainerConflictError("Ya existe una cualificación para ese formador, materia y fecha de alta");
      throw error;
    }
  }

  async updateQualification(id: string, input: TrainerQualificationInput, actorUserId: string) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.trainerQualification.findUnique({ where: { id }, include: { person: { select: personSelect } } });
        if (!existing) return undefined;
        if (existing.annulledAt) throw new TrainerReferenceError("Una cualificación anulada no puede modificarse");
        if (input.personId !== existing.personId) throw new TrainerReferenceError("El formador de una cualificación existente no puede cambiarse");
        const updated = await transaction.trainerQualification.update({
          where: { id },
          data: { authorizedSubject: input.authorizedSubject, authorizedSubjectNormalized: normalizeTrainerSubject(input.authorizedSubject), evidence: input.evidence, qualifiedFrom: asDate(input.qualifiedFrom), qualifiedTo: input.qualifiedTo ? asDate(input.qualifiedTo) : null },
          include: { person: { select: personSelect } },
        });
        await transaction.auditEvent.create({ data: auditData({ actorUserId, entityType: "TRAINER_QUALIFICATION", entityId: id, action: "TRAINER_QUALIFICATION_UPDATED", beforeJson: toQualification(existing as QualificationRow), afterJson: toQualification(updated as QualificationRow) }) });
        return toQualification(updated as QualificationRow);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new TrainerConflictError("Ya existe una cualificación para ese formador, materia y fecha de alta");
      throw error;
    }
  }

  async retireQualification(id: string, qualifiedTo: string, actorUserId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.trainerQualification.findUnique({ where: { id }, include: { person: { select: personSelect } } });
      if (!existing) return undefined;
      if (existing.annulledAt) throw new TrainerReferenceError("Una cualificación anulada no puede darse de baja");
      const current = toQualification(existing as QualificationRow);
      if (qualifiedTo < current.qualifiedFrom) throw new TrainerReferenceError("La fecha de baja no puede ser anterior a la fecha de alta");
      const updated = await transaction.trainerQualification.update({
        where: { id },
        data: { qualifiedTo: asDate(qualifiedTo) },
        include: { person: { select: personSelect } },
      });
      await transaction.auditEvent.create({
        data: auditData({
          actorUserId,
          entityType: "TRAINER_QUALIFICATION",
          entityId: id,
          action: "TRAINER_QUALIFICATION_RETIRED",
          beforeJson: current,
          afterJson: toQualification(updated as QualificationRow),
        }),
      });
      return toQualification(updated as QualificationRow);
    });
  }

  async annulQualification(id: string, reason: string, actorUserId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.trainerQualification.findUnique({ where: { id }, include: { person: { select: personSelect } } });
      if (!existing) return undefined;
      if (existing.annulledAt) return toQualification(existing as QualificationRow);
      const before = toQualification(existing as QualificationRow);
      const updated = await transaction.trainerQualification.update({
        where: { id },
        data: { annulledAt: new Date(), annulledByUserId: actorUserId, annulmentReason: reason.trim() },
        include: { person: { select: personSelect } },
      });
      const after = toQualification(updated as QualificationRow);
      await transaction.auditEvent.create({
        data: auditData({
          actorUserId,
          entityType: "TRAINER_QUALIFICATION",
          entityId: id,
          action: "TRAINER_QUALIFICATION_ANNULLED",
          beforeJson: before,
          afterJson: after,
          contextJson: { reason: reason.trim() },
        }),
      });
      return after;
    });
  }

  async importQualifications(inputs: TrainerQualificationInput[], actorUserId: string) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const rows: QualificationRow[] = [];
        for (const input of inputs) {
          await this.validatePerson(input.personId, transaction);
          const row = await transaction.trainerQualification.create({
            data: { personId: input.personId, authorizedSubject: input.authorizedSubject, authorizedSubjectNormalized: normalizeTrainerSubject(input.authorizedSubject), evidence: input.evidence, qualifiedFrom: asDate(input.qualifiedFrom), qualifiedTo: input.qualifiedTo ? asDate(input.qualifiedTo) : null },
            include: { person: { select: personSelect } },
          });
          rows.push(row as QualificationRow);
        }
        const importId = crypto.randomUUID();
        await transaction.auditEvent.create({ data: auditData({ actorUserId, entityType: "TRAINER_QUALIFICATION_IMPORT", entityId: importId, action: "TRAINER_QUALIFICATIONS_IMPORTED", afterJson: { count: rows.length } }) });
        return rows.map(toQualification);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new TrainerConflictError("La importación contiene una cualificación ya registrada");
      throw error;
    }
  }

  async listDocuments(personId: string) {
    const rows = await this.prisma.trainerDocument.findMany({
      where: { personId },
      select: { id: true, personId: true, fileName: true, mimeType: true, sizeBytes: true, uploadedByUserId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDocumentMeta);
  }

  async listAllDocuments() {
    const rows = await this.prisma.trainerDocument.findMany({
      select: { id: true, personId: true, fileName: true, mimeType: true, sizeBytes: true, uploadedByUserId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDocumentMeta);
  }

  async addDocument(personId: string, input: TrainerDocumentInput, actorUserId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.validatePerson(personId, transaction, false);
      const row = await transaction.trainerDocument.create({
        data: { personId, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.content.byteLength, content: Uint8Array.from(input.content), uploadedByUserId: actorUserId },
        select: { id: true, personId: true, fileName: true, mimeType: true, sizeBytes: true, uploadedByUserId: true, createdAt: true },
      });
      const meta = toDocumentMeta(row);
      await transaction.auditEvent.create({ data: auditData({ actorUserId, entityType: "TRAINER_DOCUMENT", entityId: row.id, action: "TRAINER_DOCUMENT_ADDED", afterJson: meta }) });
      return meta;
    });
  }

  async getDocument(documentId: string): Promise<TrainerDocumentContent | undefined> {
    const row = await this.prisma.trainerDocument.findUnique({ where: { id: documentId } });
    if (!row) return undefined;
    return { ...toDocumentMeta(row), content: Buffer.from(row.content) };
  }

  async removeDocument(documentId: string, actorUserId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const row = await transaction.trainerDocument.findUnique({ where: { id: documentId }, select: { id: true, personId: true, fileName: true, mimeType: true, sizeBytes: true, uploadedByUserId: true, createdAt: true } });
      if (!row) return undefined;
      const meta = toDocumentMeta(row);
      await transaction.trainerDocument.delete({ where: { id: documentId } });
      await transaction.auditEvent.create({ data: auditData({ actorUserId, entityType: "TRAINER_DOCUMENT", entityId: documentId, action: "TRAINER_DOCUMENT_REMOVED", beforeJson: meta }) });
      return meta;
    });
  }
}
