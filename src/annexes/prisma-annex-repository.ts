import { Prisma, PrismaClient, type AnnexType as PrismaAnnexType } from "@prisma/client";
import { validateGeneratedDocumentInput, type AnnexRepository, type GeneratedDocumentInput } from "@/annexes/annex-repository";
import type { AnnexType, GeneratedDocument, TemplateVersion } from "@/annexes/types";
import type { CurrentUser } from "@/auth/current-user";
import { auditData } from "@/administration/prisma-audit-repository";
import { AdminConflictError, overlaps, type TemplateCreateInput, type TemplateUpdateInput } from "@/administration/types";
import { isSupportedDevelopmentFixture } from "@/annexes/supported-fixtures";

export class PrismaAnnexRepository implements AnnexRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listTemplateVersions(annexType: AnnexType): Promise<TemplateVersion[]> {
    const rows = await this.prisma.templateVersion.findMany({ where: { annexType: annexType as PrismaAnnexType }, orderBy: { effectiveFrom: "desc" } });
    return rows.map((row) => ({
      ...row,
      annexType: row.annexType as AnnexType,
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveTo: row.effectiveTo?.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));
  }
  async listAllTemplateVersions() {
    const types: AnnexType[] = ["ANNEX_III", "ANNEX_IV", "ANNEX_V"]; return (await Promise.all(types.map((type) => this.listTemplateVersions(type)))).flat().sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  }
  private async assertActivation(candidate: TemplateVersion, existing: TemplateVersion[]) {
    if (!candidate.active) return; if (!isSupportedDevelopmentFixture(candidate)) throw new AdminConflictError("La versión no puede activarse porque su proveedor de almacenamiento todavía no está soportado o su metadata no coincide con la fixture disponible.");
    if (existing.some((item) => item.id !== candidate.id && item.annexType === candidate.annexType && item.active && overlaps(item, candidate))) throw new AdminConflictError("Ya existe una versión activa con una vigencia solapada para este anexo");
  }
  async registerTemplateVersion(input: TemplateCreateInput, actor: CurrentUser) {
    if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) throw new AdminConflictError("La fecha de fin no puede ser anterior al inicio");
    try { return await this.prisma.$transaction(async (tx) => {
      const candidate: TemplateVersion = { ...input, effectiveTo: input.effectiveTo ?? undefined, id: crypto.randomUUID(), createdAt: new Date().toISOString() }; const existing = (await tx.templateVersion.findMany()).map((row) => ({ ...row, annexType: row.annexType as AnnexType, effectiveFrom: row.effectiveFrom.toISOString(), effectiveTo: row.effectiveTo?.toISOString(), createdAt: row.createdAt.toISOString() })); await this.assertActivation(candidate, existing);
      const row = await tx.templateVersion.create({ data: { ...input, id: candidate.id, annexType: input.annexType as PrismaAnnexType, effectiveFrom: new Date(input.effectiveFrom), effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null } });
      const result = { ...candidate, createdAt: row.createdAt.toISOString() }; await tx.auditEvent.create({ data: auditData({ actorUserId: actor.id, entityType: "TEMPLATE_VERSION", entityId: result.id, action: "TEMPLATE_VERSION_REGISTERED", afterJson: result }) }); return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AdminConflictError("La versión de plantilla ya existe"); throw error; }
  }
  async updateTemplateVersion(id: string, input: TemplateUpdateInput, actor: CurrentUser) {
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.templateVersion.findUnique({ where: { id } }); if (!stored) return undefined;
      const before: TemplateVersion = { ...stored, annexType: stored.annexType as AnnexType, effectiveFrom: stored.effectiveFrom.toISOString(), effectiveTo: stored.effectiveTo?.toISOString(), createdAt: stored.createdAt.toISOString() };
      const after: TemplateVersion = { ...before, ...input, effectiveTo: input.effectiveTo === null ? undefined : input.effectiveTo ?? before.effectiveTo };
      if (after.effectiveTo && after.effectiveTo < after.effectiveFrom) throw new AdminConflictError("La fecha de fin no puede ser anterior al inicio"); const existing = (await tx.templateVersion.findMany()).map((row) => ({ ...row, annexType: row.annexType as AnnexType, effectiveFrom: row.effectiveFrom.toISOString(), effectiveTo: row.effectiveTo?.toISOString(), createdAt: row.createdAt.toISOString() })); await this.assertActivation(after, existing);
      await tx.templateVersion.update({ where: { id }, data: { active: after.active, effectiveFrom: new Date(after.effectiveFrom), effectiveTo: after.effectiveTo ? new Date(after.effectiveTo) : null } });
      const action = before.active !== after.active ? (after.active ? "TEMPLATE_VERSION_ACTIVATED" : "TEMPLATE_VERSION_DEACTIVATED") : "TEMPLATE_VERSION_UPDATED";
      await tx.auditEvent.create({ data: auditData({ actorUserId: actor.id, entityType: "TEMPLATE_VERSION", entityId: id, action, beforeJson: before, afterJson: after }) }); return after;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createGeneratedDocument(input: GeneratedDocumentInput): Promise<GeneratedDocument> {
    validateGeneratedDocumentInput(input);
    const row = await this.prisma.generatedDocument.create({ data: { ...input, sessionId: input.sessionId ?? null, personId: input.personId ?? null, year: input.year ?? null, annexType: input.annexType as PrismaAnnexType } });
    return { ...row, sessionId: row.sessionId ?? undefined, personId: row.personId ?? undefined, year: row.year ?? undefined, annexType: row.annexType as AnnexType, generatedAt: row.generatedAt.toISOString() };
  }

  async listGeneratedDocuments(sessionId: string): Promise<GeneratedDocument[]> {
    const rows = await this.prisma.generatedDocument.findMany({ where: { sessionId }, orderBy: { generatedAt: "asc" } });
    return rows.map((row) => ({ ...row, sessionId: row.sessionId ?? undefined, personId: row.personId ?? undefined, year: row.year ?? undefined, annexType: row.annexType as AnnexType, generatedAt: row.generatedAt.toISOString() }));
  }
}
