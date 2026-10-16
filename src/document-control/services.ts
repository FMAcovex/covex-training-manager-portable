import { getSessionRepository } from "@/server/session-repositories";
import { getTrainingRepository } from "@/server/training-repositories";
import { PrismaDocumentControlRepository } from "./prisma-repository";
import { InMemoryDocumentControlRepository, type DocumentControlRepository } from "./repository";
import { DocumentControlService } from "./service";
import { getAuditEventRepository } from "@/administration/repositories";
import { prisma } from "@/server/prisma";
import { shouldUsePersistentRepositories, shouldUsePortableSharePoint } from "@/config/runtime";
import { getPortableProvider } from "@/portable/sharepoint/provider";

const globalForDocumentControl = globalThis as unknown as { demoDocumentControlRepository?: DocumentControlRepository };

export function getDocumentControlRepository(): DocumentControlRepository {
  if (shouldUsePortableSharePoint()) return getPortableProvider().documentControl;
  if (shouldUsePersistentRepositories()) return new PrismaDocumentControlRepository(prisma);
  globalForDocumentControl.demoDocumentControlRepository ??= new InMemoryDocumentControlRepository(undefined, getAuditEventRepository());
  return globalForDocumentControl.demoDocumentControlRepository;
}

export function getDocumentControlService() {
  return new DocumentControlService(getDocumentControlRepository(), getSessionRepository(), getTrainingRepository());
}
