import { getAuditEventRepository } from "@/administration/repositories";
import { shouldUsePersistentRepositories } from "@/config/runtime";
import { getPeopleRepository } from "@/server/people-repositories";
import { prisma } from "@/server/prisma";
import { PrismaTrainerRepository } from "@/server/prisma-trainer-repository";
import { InMemoryTrainerRepository, type TrainerRepository } from "@/server/trainer-repository";

const globalDemoRepositories = globalThis as unknown as { trainerRepository?: TrainerRepository };

export function getTrainerRepository(): TrainerRepository {
  if (shouldUsePersistentRepositories()) return new PrismaTrainerRepository(prisma);
  globalDemoRepositories.trainerRepository ??= new InMemoryTrainerRepository(getPeopleRepository(), getAuditEventRepository(), true);
  return globalDemoRepositories.trainerRepository;
}
