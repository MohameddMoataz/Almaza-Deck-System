import { PrismaClient } from "@prisma/client";
import { cloudDatabase, usesCloudStorage } from "./cloudDb";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  usesCloudStorage ? cloudDatabase() as unknown as PrismaClient :
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (!usesCloudStorage && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
