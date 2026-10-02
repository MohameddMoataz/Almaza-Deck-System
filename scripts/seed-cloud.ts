import { readFile } from "fs/promises";
import { PrismaClient } from "../src/generated/cloud-client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();
async function main() {
  if (process.env.STORAGE_BACKEND !== "postgres") throw new Error("Set STORAGE_BACKEND=postgres.");
  const existing = await db.user.findUnique({ where: { username: "admin" } });
  if (!existing) {
    const password = process.env.ADMIN_PASSWORD ?? "";
    if (password.length < 12 || password === "admin@123") throw new Error("Set ADMIN_PASSWORD to a new password of at least 12 characters.");
    await db.user.create({ data: { username: "admin", role: "ADMIN", passwordHash: await hashPassword(password) } });
  } else if (existing.role !== "ADMIN") {
    throw new Error("The admin username already belongs to a regular account. Resolve this before deployment.");
  }
  const sets = JSON.parse(await readFile("data/saved-card-sets.json", "utf8")) as Array<{ id: string }>;
  const cards = JSON.parse(await readFile("data/power-of-chaos-kaiba-cards.json", "utf8")) as Array<{ name: string }>;
  for (const [key, value] of [
    ...sets.map((set) => [`saved-set:${set.id}`, JSON.stringify(set)]),
    ...cards.map((card) => [`card-override:${card.name.trim().toLowerCase()}`, JSON.stringify(card)])
  ]) {
    // Redeployments add missing defaults, never replace edits made on the live site.
    await db.appDocument.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  console.log("Cloud admin and default content ready. Existing passwords and content preserved.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => db.$disconnect());
