import { readFile } from "fs/promises";
import { z } from "zod";
import { PrismaClient } from "../src/generated/cloud-client";

const schema = z.object({
  version: z.literal(1),
  users: z.array(z.object({
    id: z.string(), username: z.string().refine((name) => name !== "admin"),
    passwordHash: z.string(), role: z.literal("USER"), createdAt: z.coerce.date()
  })),
  cards: z.array(z.object({
    id: z.string(), ownerId: z.string(), section: z.enum(["MAIN", "EXTRA", "EXTRA_CARDS", "SIDE"]),
    cardApiId: z.number().int(), cardName: z.string(), cardImage: z.string(), cardType: z.string(), description: z.string(),
    atk: z.number().int().nullable(), def: z.number().int().nullable(), level: z.number().int().nullable(),
    quantity: z.number().int().positive(), addedAt: z.coerce.date(), updatedAt: z.coerce.date()
  })),
  documents: z.array(z.object({ key: z.string().regex(/^(saved-set|card-override|translation-ar):/), value: z.string().refine((value) => { try { JSON.parse(value); return true; } catch { return false; } }) }))
});
const db = new PrismaClient();
async function main() {
  if (process.env.STORAGE_BACKEND !== "postgres") throw new Error("Set STORAGE_BACKEND=postgres.");
  const file = process.argv[2];
  if (!file) throw new Error("Usage: pnpm cloud:import exports/almaza-TIMESTAMP.json");
  const data = schema.parse(JSON.parse(await readFile(file, "utf8")));
  await db.$transaction(async (transaction) => {
    if (await transaction.user.count({ where: { role: { not: "ADMIN" } } }) || await transaction.deckCard.count()) {
      throw new Error("Import requires a fresh cloud database with no players or decks. Nothing was changed.");
    }
    if (data.users.length) await transaction.user.createMany({ data: data.users });
    if (data.cards.length) await transaction.deckCard.createMany({ data: data.cards });
    for (const document of data.documents) {
      await transaction.appDocument.upsert({ where: { key: document.key }, create: document, update: {} });
    }
  }, { timeout: 120000 });
  console.log(`Imported ${data.users.length} players and ${data.cards.length} deck entries. Existing cloud content and admin password preserved.`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
