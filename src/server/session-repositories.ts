import { getPeopleRepository } from "@/server/people-repositories";
import { PrismaSessionRepository } from "@/server/prisma-session-repository";
import { InMemorySessionRepository, type SessionRepository } from "@/server/session-repository";
import { getTrainingRepository } from "@/server/training-repositories";
import { getAuditEventRepository } from "@/administration/repositories";
import { prisma } from "@/server/prisma";
import { shouldUsePersistentRepositories, shouldUsePortableSharePoint } from "@/config/runtime";
import { getPortableProvider } from "@/portable/sharepoint/provider";

const globalDemoRepositories = globalThis as unknown as {
  sessionRepository?: SessionRepository;
};

export function getSessionRepository(): SessionRepository {
  if (shouldUsePortableSharePoint()) return getPortableProvider().sessions;
  if (shouldUsePersistentRepositories()) return new PrismaSessionRepository(prisma);
  globalDemoRepositories.sessionRepository ??= new InMemorySessionRepository(
    getTrainingRepository(),
    getPeopleRepository(),
    undefined,
    getAuditEventRepository(),
    true,
  );
  return globalDemoRepositories.sessionRepository;
}
