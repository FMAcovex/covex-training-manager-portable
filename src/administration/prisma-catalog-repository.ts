import { Prisma, PrismaClient } from "@prisma/client";
import type { CurrentUser } from "@/auth/current-user";
import { auditData } from "./prisma-audit-repository";
import type { CatalogAdminRepository } from "./catalog-repository";
import { AdminConflictError, type AdminCatalogItem, type CatalogCreateInput, type CatalogKind, type CatalogUpdateInput } from "./types";

export class PrismaCatalogAdminRepository implements CatalogAdminRepository {
  constructor(private readonly prisma: PrismaClient) {}
  private async rows(kind: CatalogKind, client: Prisma.TransactionClient | PrismaClient = this.prisma): Promise<AdminCatalogItem[]> {
    if (kind === "training-types") return (await client.trainingType.findMany({ include: { _count: { select: { trainings: true } } }, orderBy: { name: "asc" } })).map(({ _count, ...item }) => ({ ...item, referenced: _count.trainings > 0 }));
    if (kind === "modalities") return (await client.modality.findMany({ include: { _count: { select: { trainings: true } } }, orderBy: { name: "asc" } })).map(({ _count, ...item }) => ({ ...item, referenced: _count.trainings > 0 }));
    if (kind === "evaluation-methods") return (await client.evaluationMethod.findMany({ include: { _count: { select: { trainings: true } } }, orderBy: { name: "asc" } })).map(({ _count, ...item }) => ({ ...item, referenced: _count.trainings > 0 }));
    return (await client.department.findMany({ include: { _count: { select: { people: true } } }, orderBy: { name: "asc" } })).map(({ _count, ...item }) => ({ ...item, referenced: _count.people > 0 }));
  }
  async list(kind: CatalogKind) { return this.rows(kind); }
  async create(kind: CatalogKind, input: CatalogCreateInput, actor: CurrentUser) {
    try { return await this.prisma.$transaction(async (tx) => {
      const row = kind === "training-types" ? await tx.trainingType.create({ data: input }) : kind === "modalities" ? await tx.modality.create({ data: input }) : kind === "evaluation-methods" ? await tx.evaluationMethod.create({ data: input }) : await tx.department.create({ data: input });
      const item = { ...row, referenced: false }; await tx.auditEvent.create({ data: auditData({ actorUserId: actor.id, entityType: "CATALOG", entityId: item.id, action: "CATALOG_CREATED", afterJson: item, contextJson: { kind } }) }); return item;
    }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AdminConflictError("El código ya existe"); throw error; }
  }
  async update(kind: CatalogKind, id: string, input: CatalogUpdateInput, actor: CurrentUser) {
    return this.prisma.$transaction(async (tx) => {
      const before = (await this.rows(kind, tx)).find((item) => item.id === id); if (!before) return undefined;
      if (input.name !== undefined && input.name !== before.name && before.referenced) throw new AdminConflictError("El elemento está referenciado históricamente. Desactívelo y cree uno nuevo para preservar la trazabilidad.");
      const row = kind === "training-types" ? await tx.trainingType.update({ where: { id }, data: input }) : kind === "modalities" ? await tx.modality.update({ where: { id }, data: input }) : kind === "evaluation-methods" ? await tx.evaluationMethod.update({ where: { id }, data: input }) : await tx.department.update({ where: { id }, data: input });
      const after = { ...row, referenced: before.referenced }; const action = before.active !== after.active ? (after.active ? "CATALOG_ACTIVATED" : "CATALOG_DEACTIVATED") : "CATALOG_UPDATED";
      await tx.auditEvent.create({ data: auditData({ actorUserId: actor.id, entityType: "CATALOG", entityId: id, action, beforeJson: before, afterJson: after, contextJson: { kind } }) }); return after;
    });
  }
}
