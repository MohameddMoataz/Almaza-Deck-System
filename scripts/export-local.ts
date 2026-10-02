import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
async function main() {
  if (process.env.STORAGE_BACKEND === "postgres") throw new Error("Run this using your local SQLite environment.");
  const users = await db.user.findMany({ where: { role: "USER", username: { not: "admin" } } });
  const cards = await db.deckCard.findMany({ where: { ownerId: { in: users.map((user) => user.id) } } });
  const sets = JSON.parse(await readFile("data/saved-card-sets.json", "utf8")) as Array<{ id: string }>;
  const overrides = JSON.parse(await readFile("data/power-of-chaos-kaiba-cards.json", "utf8")) as Array<{ name: string }>;
  const documents = [
    ...sets.map((set) => ({ key: `saved-set:${set.id}`, value: JSON.stringify(set) })),
    ...overrides.map((card) => ({ key: `card-override:${card.name.trim().toLowerCase()}`, value: JSON.stringify(card) }))
  ];
  let translations: string[] = [];
  try { translations = await readdir("data/translations/ar"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  for (const name of translations.filter((file) => /^[a-f0-9]{64}\.json$/.test(file))) {
    documents.push({ key: `translation-ar:${name.slice(0, -5)}`, value: await readFile(path.join("data/translations/ar", name), "utf8") });
  }
  await mkdir("exports", { recursive: true });
  const file = path.join("exports", `almaza-${Date.now()}.json`);
  await writeFile(file, JSON.stringify({ version: 1, users, cards, documents }, null, 2), { flag: "wx", mode: 0o600 });
  console.log(`Exported ${users.length} players and ${cards.length} deck entries to ${file}. Local admin excluded; keep this private.`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
