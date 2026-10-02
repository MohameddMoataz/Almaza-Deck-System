import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword("admin@123");

  await prisma.user.upsert({
    where: { username: "admin" },
    update: { passwordHash, role: "ADMIN" },
    create: {
      username: "admin",
      passwordHash,
      role: "ADMIN"
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
