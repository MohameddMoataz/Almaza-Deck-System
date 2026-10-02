import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { addCardToSection } from "./deck";
import { getCardByName } from "./cards";
import { defaultSavedCardSets, SavedCardSet } from "./savedSetData";
import { cloudDatabase, usesCloudStorage } from "./cloudDb";
import { readCloudDocument, writeCloudDocument } from "./cloudContent";

const savedSetPath = path.join(process.cwd(), "data", "saved-card-sets.json");

const savedCardSetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  cards: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().int().positive().optional()
    })
  )
});

const savedCardSetsSchema = z.array(savedCardSetSchema);

async function ensureSavedSetFile() {
  await mkdir(path.dirname(savedSetPath), { recursive: true });

  try {
    await readFile(savedSetPath, "utf8");
  } catch {
    await writeSavedCardSets(defaultSavedCardSets);
  }
}

export async function readSavedCardSets() {
  if (usesCloudStorage) {
    const values = await cloudDatabase().appDocument.findMany({ where: { key: { startsWith: "saved-set:" } } });
    return savedCardSetsSchema.parse(values.map((row) => JSON.parse(row.value)));
  }
  await ensureSavedSetFile();
  const raw = await readFile(savedSetPath, "utf8");
  const parsed = savedCardSetsSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    await writeSavedCardSets(defaultSavedCardSets);
    return defaultSavedCardSets;
  }

  return parsed.data;
}

export async function writeSavedCardSets(savedSets: SavedCardSet[]) {
  if (usesCloudStorage) {
    await Promise.all(savedSets.map((set) => writeCloudDocument(`saved-set:${set.id}`, set)));
    return;
  }
  await mkdir(path.dirname(savedSetPath), { recursive: true });
  await writeFile(savedSetPath, `${JSON.stringify(savedSets, null, 2)}\n`, "utf8");
}

export async function updateSavedCardSet(nextSet: SavedCardSet) {
  if (usesCloudStorage) {
    const key = `saved-set:${nextSet.id}`;
    if (!await readCloudDocument(key)) throw new Error("Saved card set not found.");
    await writeCloudDocument(key, savedCardSetSchema.parse(nextSet));
    return nextSet;
  }
  const savedSets = await readSavedCardSets();
  const index = savedSets.findIndex((set) => set.id === nextSet.id);

  if (index === -1) throw new Error("Saved card set not found.");

  const nextSets = [...savedSets];
  nextSets[index] = nextSet;
  await writeSavedCardSets(nextSets);

  return nextSet;
}

export async function getSavedCardSet(setId: string) {
  const savedCardSets = await readSavedCardSets();
  return savedCardSets.find((set) => set.id === setId) ?? null;
}

export async function importSavedCardSet(ownerId: string, setId: string) {
  const set = await getSavedCardSet(setId);
  if (!set) throw new Error("Saved card set not found.");

  const missing: string[] = [];
  let imported = 0;

  for (const savedCard of set.cards) {
    const card = await getCardByName(savedCard.name);
    if (!card) {
      missing.push(savedCard.name);
      continue;
    }

    const quantity = savedCard.quantity ?? 1;
    for (let index = 0; index < quantity; index += 1) {
      await addCardToSection(ownerId, "EXTRA_CARDS", card);
      imported += 1;
    }
  }

  return {
    imported,
    missing
  };
}
