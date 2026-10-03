import { readFile } from "fs/promises";
import { PrismaClient } from "../src/generated/cloud-client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

type CardOverride = {
  name: string;
  description?: string;
  gameSource?: string;
  gameIndex?: number;
  gameInternalId?: number;
  gameImageFile?: string;
};

function mergeGameCardOverride(existingValue: string | null, next: CardOverride) {
  if (!existingValue) return JSON.stringify(next);
  if (!next.gameSource) return existingValue;

  const existing = JSON.parse(existingValue) as Record<string, unknown>;
  return JSON.stringify({
    ...existing,
    description: next.description,
    gameSource: next.gameSource,
    gameIndex: next.gameIndex,
    gameInternalId: next.gameInternalId,
    gameImageFile: next.gameImageFile
  });
}

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
  const cards = JSON.parse(await readFile("data/power-of-chaos-kaiba-cards.json", "utf8")) as CardOverride[];
  for (const [key, value] of sets.map((set) => [`saved-set:${set.id}`, JSON.stringify(set)])) {
    // Redeployments add missing defaults, never replace edits made on the live site.
    await db.appDocument.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  for (const card of cards) {
    const key = `card-override:${card.name.trim().toLowerCase()}`;
    const existingDocument = await db.appDocument.findUnique({ where: { key } });
    await db.appDocument.upsert({
      where: { key },
      create: { key, value: JSON.stringify(card) },
      update: { value: mergeGameCardOverride(existingDocument?.value ?? null, card) }
    });
  }
  console.log("Cloud admin and default content ready. Existing passwords and content preserved.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => db.$disconnect());
