import { PrismaClient } from "../generated/cloud-client";

const globalForCloud = globalThis as unknown as { cloudPrisma?: PrismaClient };
export const usesCloudStorage = process.env.STORAGE_BACKEND === "postgres";

export function cloudDatabase() {
  if (!usesCloudStorage) throw new Error("Cloud database is not enabled.");
  if (!globalForCloud.cloudPrisma) globalForCloud.cloudPrisma = new PrismaClient();
  return globalForCloud.cloudPrisma;
}
