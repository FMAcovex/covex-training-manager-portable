import { InMemoryTrainingRepository, type TrainingRepository } from "@/server/training-repository";
import { PrismaTrainingRepository } from "@/server/prisma-training-repository";
import { prisma } from "@/server/prisma";
import { shouldUsePersistentRepositories } from "@/config/runtime";
import { getAuditEventRepository } from "@/administration/repositories";

const globalDemoRepositories = globalThis as unknown as {
  trainingRepository?: TrainingRepository;
};

export function getTrainingRepository(): TrainingRepository {
  if (shouldUsePersistentRepositories()) return new PrismaTrainingRepository(prisma);
  globalDemoRepositories.trainingRepository ??= new InMemoryTrainingRepository(undefined, undefined, getAuditEventRepository(), true);
  return globalDemoRepositories.trainingRepository;
}
