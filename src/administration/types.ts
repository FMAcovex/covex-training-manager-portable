import { z } from "zod";
import type { AppRole } from "@/auth/current-user";
import type { AnnexType, TemplateVersion } from "@/annexes/types";
import type { CatalogItem } from "@/domain/training-catalogs";

export type UserProfile = {
  id: string; entraObjectId: string; email: string; displayName: string; role: AppRole;
  active: boolean; createdAt: string; updatedAt: string;
};

export type CatalogKind = "training-types" | "modalities" | "evaluation-methods" | "departments";
export type AdminCatalogItem = CatalogItem & { referenced: boolean };

export type AuditEvent = {
  id: string; actorUserId: string; actorDisplayName?: string; timestamp: string;
  entityType: string; entityId: string; action: string;
  beforeJson?: unknown; afterJson?: unknown; contextJson?: unknown;
};
export type AuditEventInput = Omit<AuditEvent, "id" | "timestamp" | "actorDisplayName">;
export type AuditFilters = { entityType?: string; action?: string; actorUserId?: string; from?: string; to?: string; search?: string; limit?: number; offset?: number };

export const userCreateSchema = z.object({
  entraObjectId: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(1).max(200),
  role: z.enum(["USER", "RESPONSIBLE", "ADMIN"]),
  active: z.boolean().default(true),
}).strict();
export const userUpdateSchema = z.object({
  email: z.string().trim().email().max(254).optional(),
  displayName: z.string().trim().min(1).max(200).optional(),
  role: z.enum(["USER", "RESPONSIBLE", "ADMIN"]).optional(),
  active: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Debe indicar algún cambio");
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const catalogKinds = ["training-types", "modalities", "evaluation-methods", "departments"] as const;
export const catalogKindSchema = z.enum(catalogKinds);
export const catalogCreateSchema = z.object({ code: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()), name: z.string().trim().min(1).max(200), active: z.boolean().default(true) }).strict();
export const catalogUpdateSchema = z.object({ name: z.string().trim().min(1).max(200).optional(), active: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, "Debe indicar algún cambio");
export type CatalogCreateInput = z.infer<typeof catalogCreateSchema>;
export type CatalogUpdateInput = z.infer<typeof catalogUpdateSchema>;

const isoDate = z.string().datetime({ offset: true });
export const templateCreateSchema = z.object({
  annexType: z.enum(["ANNEX_III", "ANNEX_IV", "ANNEX_V"]), procedureCode: z.string().trim().min(1).max(100),
  templateVersion: z.string().trim().min(1).max(100), storageProvider: z.string().trim().min(1).max(100),
  storageReference: z.string().trim().min(1).max(500), effectiveFrom: isoDate, effectiveTo: isoDate.nullish(), active: z.boolean().default(false),
}).strict();
export const templateUpdateSchema = z.object({ effectiveFrom: isoDate.optional(), effectiveTo: isoDate.nullish(), active: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, "Debe indicar algún cambio");
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;

export function overlaps(a: Pick<TemplateVersion, "effectiveFrom" | "effectiveTo">, b: Pick<TemplateVersion, "effectiveFrom" | "effectiveTo">) {
  const aStart = new Date(a.effectiveFrom).valueOf(); const aEnd = a.effectiveTo ? new Date(a.effectiveTo).valueOf() : Number.POSITIVE_INFINITY;
  const bStart = new Date(b.effectiveFrom).valueOf(); const bEnd = b.effectiveTo ? new Date(b.effectiveTo).valueOf() : Number.POSITIVE_INFINITY;
  return aStart <= bEnd && bStart <= aEnd;
}

export type { AnnexType, TemplateVersion };

export class AdminConflictError extends Error {}
export class AdminNotFoundError extends Error {}
export class AdminAuthorizationError extends Error { constructor() { super("No autorizado"); } }
