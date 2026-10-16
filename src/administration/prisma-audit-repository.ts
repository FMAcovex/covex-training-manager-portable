import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuditEventRepository } from "./audit-repository";
import type { AuditEvent, AuditEventInput, AuditFilters } from "./types";

export function auditData(input: AuditEventInput) {
  return { actorUserId: input.actorUserId, entityType: input.entityType, entityId: input.entityId, action: input.action,
    beforeJson: input.beforeJson === undefined ? undefined : input.beforeJson as Prisma.InputJsonValue,
    afterJson: input.afterJson === undefined ? undefined : input.afterJson as Prisma.InputJsonValue,
    contextJson: input.contextJson === undefined ? undefined : input.contextJson as Prisma.InputJsonValue };
}
const toDomain = (row: { id: string; actorUserId: string; timestamp: Date; entityType: string; entityId: string; action: string; beforeJson: unknown; afterJson: unknown; contextJson: unknown; actorUser?: { displayName: string } }): AuditEvent => ({
  id: row.id, actorUserId: row.actorUserId, actorDisplayName: row.actorUser?.displayName, timestamp: row.timestamp.toISOString(), entityType: row.entityType, entityId: row.entityId, action: row.action,
  beforeJson: row.beforeJson ?? undefined, afterJson: row.afterJson ?? undefined, contextJson: row.contextJson ?? undefined,
});

export class PrismaAuditEventRepository implements AuditEventRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async append(input: AuditEventInput) { return toDomain(await this.prisma.auditEvent.create({ data: auditData(input) })); }
  async list(filters: AuditFilters = {}) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200); const offset = Math.max(filters.offset ?? 0, 0);
    return (await this.prisma.auditEvent.findMany({ where: {
      entityType: filters.entityType, action: filters.action, actorUserId: filters.actorUserId,
      timestamp: filters.from || filters.to ? { gte: filters.from ? new Date(filters.from) : undefined, lte: filters.to ? new Date(filters.to) : undefined } : undefined,
      ...(filters.search ? { OR: [{ entityId: { contains: filters.search, mode: "insensitive" } }, { action: { contains: filters.search, mode: "insensitive" } }] } : {}),
    }, include: { actorUser: { select: { displayName: true } } }, orderBy: { timestamp: "desc" }, skip: offset, take: limit })).map(toDomain);
  }
}
