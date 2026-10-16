import { InMemoryAuditEventRepository, type AuditEventRepository } from "./audit-repository";
import { PrismaAuditEventRepository } from "./prisma-audit-repository";
import { InMemoryUserProfileRepository, type UserProfileRepository } from "./user-profile-repository";
import { PrismaUserProfileRepository } from "./prisma-user-profile-repository";
import { InMemoryCatalogAdminRepository, type CatalogAdminRepository } from "./catalog-repository";
import { PrismaCatalogAdminRepository } from "./prisma-catalog-repository";
import { getTrainingRepository } from "@/server/training-repositories";
import { getPeopleRepository } from "@/server/people-repositories";
import { prisma } from "@/server/prisma";
import { shouldUsePersistentRepositories } from "@/config/runtime";

const globalAdmin = globalThis as unknown as { auditRepository?: AuditEventRepository; userProfileRepository?: UserProfileRepository; catalogAdminRepository?: CatalogAdminRepository };

export function getAuditEventRepository(): AuditEventRepository {
  if (shouldUsePersistentRepositories()) return new PrismaAuditEventRepository(prisma);
  globalAdmin.auditRepository ??= new InMemoryAuditEventRepository(undefined, true); return globalAdmin.auditRepository;
}
export function getUserProfileRepository(): UserProfileRepository {
  if (shouldUsePersistentRepositories()) return new PrismaUserProfileRepository(prisma);
  globalAdmin.userProfileRepository ??= new InMemoryUserProfileRepository(getAuditEventRepository()); return globalAdmin.userProfileRepository;
}
export function getCatalogAdminRepository(): CatalogAdminRepository {
  if (shouldUsePersistentRepositories()) return new PrismaCatalogAdminRepository(prisma);
  globalAdmin.catalogAdminRepository ??= new InMemoryCatalogAdminRepository(getAuditEventRepository(), getTrainingRepository(), getPeopleRepository(), undefined, true); return globalAdmin.catalogAdminRepository;
}
