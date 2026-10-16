import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { covexPrisma?: PrismaClient };

export const prisma = globalForPrisma.covexPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.covexPrisma = prisma;

export async function checkDatabaseConnection() {
  await prisma.$queryRaw`SELECT 1`;
}
