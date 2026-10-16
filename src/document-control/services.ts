import { getSessionRepository } from "@/server/session-repositories";
import { getTrainingRepository } from "@/server/training-repositories";
import { PrismaDocumentControlRepository } from "./prisma-repository";
import { InMemoryDocumentControlRepository, type DocumentControlRepository } from "./repository";
import { DocumentControlService } from "./service";
import { getAuditEventRepository } from "@/administration/repositories";
import { prisma } from "@/server/prisma";
import { shouldUsePersistentRepositories } from "@/config/runtime";

const globalForDocumentControl = globalThis as unknown as { demoDocumentControlRepository?: DocumentControlRepository };

export function getDocumentControlRepository(): DocumentControlRepository {
  if (shouldUsePersistentRepositories()) return new PrismaDocumentControlRepository(prisma);
  globalForDocumentControl.demoDocumentControlRepository ??= new InMemoryDocumentControlRepository(undefined, getAuditEventRepository());
  return globalForDocumentControl.demoDocumentControlRepository;
}

export function getDocumentControlService() {
  return new DocumentControlService(getDocumentControlRepository(), getSessionRepository(), getTrainingRepository());
}
