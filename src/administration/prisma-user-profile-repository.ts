import { Prisma, PrismaClient, type UserRole } from "@prisma/client";
import type { CurrentUser } from "@/auth/current-user";
import { auditData } from "./prisma-audit-repository";
import type { UserProfileRepository } from "./user-profile-repository";
import { AdminConflictError, type UserCreateInput, type UserProfile, type UserUpdateInput } from "./types";

const toDomain = (row: { id: string; entraObjectId: string; email: string; displayName: string; role: UserRole; active: boolean; createdAt: Date; updatedAt: Date }): UserProfile => ({ ...row, role: row.role, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
const uniqueness = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export class PrismaUserProfileRepository implements UserProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async list() { return (await this.prisma.userProfile.findMany({ orderBy: { displayName: "asc" } })).map(toDomain); }
  async findById(id: string) { const row = await this.prisma.userProfile.findUnique({ where: { id } }); return row ? toDomain(row) : undefined; }
  async findByEntraObjectId(entraObjectId: string) {
    const row = await this.prisma.userProfile.findFirst({ where: { entraObjectId: { equals: entraObjectId.trim(), mode: "insensitive" } } });
    return row ? toDomain(row) : undefined;
  }
  async create(input: UserCreateInput, actor: CurrentUser) {
    try { return await this.prisma.$transaction(async (tx) => {
      const row = await tx.userProfile.create({ data: { ...input, role: input.role as UserRole } }); const user = toDomain(row);
      await tx.auditEvent.create({ data: auditData({ actorUserId: actor.id, entityType: "USER_PROFILE", entityId: user.id, action: "USER_PROFILE_CREATED", afterJson: user }) }); return user;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); } catch (error) { if (uniqueness(error)) throw new AdminConflictError("El email o identificador Entra ya existe"); throw error; }
  }
  async update(id: string, input: UserUpdateInput, actor: CurrentUser) {
    try { return await this.prisma.$transaction(async (tx) => {
      const stored = await tx.userProfile.findUnique({ where: { id } }); if (!stored) return undefined; const before = toDomain(stored);
      const targetRole = input.role ?? before.role; const targetActive = input.active ?? before.active;
      if (before.role === "ADMIN" && before.active && (targetRole !== "ADMIN" || !targetActive) && await tx.userProfile.count({ where: { role: "ADMIN", active: true, id: { not: id } } }) === 0) throw new AdminConflictError("Debe existir al menos un ADMIN activo");
      const after = toDomain(await tx.userProfile.update({ where: { id }, data: { ...input, role: input.role as UserRole | undefined } }));
      const common = { actorUserId: actor.id, entityType: "USER_PROFILE", entityId: id, beforeJson: before, afterJson: after };
      if (before.role !== after.role) await tx.auditEvent.create({ data: auditData({ ...common, action: "USER_ROLE_CHANGED" }) });
      if (before.active !== after.active) await tx.auditEvent.create({ data: auditData({ ...common, action: after.active ? "USER_ACTIVATED" : "USER_DEACTIVATED" }) });
      if (before.email !== after.email || before.displayName !== after.displayName) await tx.auditEvent.create({ data: auditData({ ...common, action: "USER_PROFILE_UPDATED" }) });
      return after;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); } catch (error) { if (uniqueness(error)) throw new AdminConflictError("El email ya existe"); throw error; }
  }
}
