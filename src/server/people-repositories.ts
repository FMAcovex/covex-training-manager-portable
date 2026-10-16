import { InMemoryPeopleRepository, type PeopleRepository } from "@/server/people-repository";
import { PrismaPeopleRepository } from "@/server/prisma-people-repository";
import { prisma } from "@/server/prisma";
import { shouldUsePersistentRepositories } from "@/config/runtime";
import type { AuditEventRepository } from "@/administration/audit-repository";

const globalDemoRepositories = globalThis as unknown as {
  peopleRepository?: PeopleRepository;
};

const lazyDemoAudit: AuditEventRepository = {
  async append(input) {
    const { getAuditEventRepository } = await import("@/administration/repositories");
    return getAuditEventRepository().append(input);
  },
  async list(filters) {
    const { getAuditEventRepository } = await import("@/administration/repositories");
    return getAuditEventRepository().list(filters);
  },
};

export function getPeopleRepository(): PeopleRepository {
  if (shouldUsePersistentRepositories()) return new PrismaPeopleRepository(prisma);
  globalDemoRepositories.peopleRepository ??= new InMemoryPeopleRepository(undefined, undefined, true, lazyDemoAudit);
  return globalDemoRepositories.peopleRepository;
}
