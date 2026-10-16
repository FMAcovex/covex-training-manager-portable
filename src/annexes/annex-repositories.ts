import { InMemoryAnnexRepository, type AnnexRepository } from "@/annexes/annex-repository";
import { PrismaAnnexRepository } from "@/annexes/prisma-annex-repository";
import { getAuditEventRepository } from "@/administration/repositories";
import { prisma } from "@/server/prisma";
import { shouldUsePersistentRepositories, shouldUsePortableSharePoint } from "@/config/runtime";
import { getPortableProvider } from "@/portable/sharepoint/provider";

let demoRepository: AnnexRepository | undefined;
export function getAnnexRepository(): AnnexRepository {
  if (shouldUsePortableSharePoint()) return getPortableProvider().annexes;
  if (shouldUsePersistentRepositories()) return new PrismaAnnexRepository(prisma);
  demoRepository ??= new InMemoryAnnexRepository(undefined, getAuditEventRepository());
  return demoRepository;
}
