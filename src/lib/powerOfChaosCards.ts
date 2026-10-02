import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import type { CardSummary } from "./cards";
import { artworkProxyUrl } from "./cardArtwork";
import { cloudDatabase, usesCloudStorage } from "./cloudDb";
import { writeCloudDocument } from "./cloudContent";

const overridePath = path.join(process.cwd(), "data", "power-of-chaos-kaiba-cards.json");

const overrideSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().max(200).optional(),
  descriptionAr: z.string().max(10000).optional(),
  image: z.string().optional(),
  artworkImage: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  atk: z.number().int().nullable().optional(),
  def: z.number().int().nullable().optional(),
  level: z.number().int().nullable().optional()
});

const overridesSchema = z.array(overrideSchema);

export type PowerOfChaosCardOverride = z.infer<typeof overrideSchema>;

function keyFor(name: string) {
  return name.trim().toLowerCase();
}

export async function readPowerOfChaosOverrides() {
  if (usesCloudStorage) {
    const rows = await cloudDatabase().appDocument.findMany({ where: { key: { startsWith: "card-override:" } } });
    return overridesSchema.parse(rows.map((row) => JSON.parse(row.value)));
  }
  try {
    const raw = await fs.readFile(overridePath, "utf8");
    return overridesSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function writePowerOfChaosOverrides(overrides: PowerOfChaosCardOverride[]) {
  if (usesCloudStorage) {
    await Promise.all(overrides.map((card) => writeCloudDocument(`card-override:${keyFor(card.name)}`, card)));
    return;
  }
  await fs.mkdir(path.dirname(overridePath), { recursive: true });
  await fs.writeFile(overridePath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
}

export async function updatePowerOfChaosOverride(nextOverride: PowerOfChaosCardOverride) {
  const name = nextOverride.name.trim();
  if (!name) throw new Error("Card name is required.");

  const overrides = await readPowerOfChaosOverrides();
  const nextKey = keyFor(name);
  const cleaned: PowerOfChaosCardOverride = {
    name,
    ...(nextOverride.nameAr?.trim() ? { nameAr: nextOverride.nameAr.trim() } : {}),
    ...(nextOverride.descriptionAr?.trim() ? { descriptionAr: nextOverride.descriptionAr.trim() } : {}),
    ...(nextOverride.image?.trim() ? { image: nextOverride.image.trim() } : {}),
    ...(nextOverride.artworkImage?.trim() ? { artworkImage: nextOverride.artworkImage.trim() } : {}),
    ...(nextOverride.type?.trim() ? { type: nextOverride.type.trim() } : {}),
    ...(nextOverride.description?.trim() ? { description: nextOverride.description.trim() } : {}),
    ...(nextOverride.atk !== undefined ? { atk: nextOverride.atk } : {}),
    ...(nextOverride.def !== undefined ? { def: nextOverride.def } : {}),
    ...(nextOverride.level !== undefined ? { level: nextOverride.level } : {})
  };

  if (usesCloudStorage) {
    await writeCloudDocument(`card-override:${nextKey}`, cleaned);
    return cleaned;
  }
  const existingIndex = overrides.findIndex((override) => keyFor(override.name) === nextKey);
  const nextOverrides =
    existingIndex >= 0
      ? overrides.map((override, index) => (index === existingIndex ? cleaned : override))
      : [...overrides, cleaned];

  nextOverrides.sort((a, b) => a.name.localeCompare(b.name));
  await writePowerOfChaosOverrides(nextOverrides);
  return cleaned;
}

export async function applyPowerOfChaosOverride(card: CardSummary): Promise<CardSummary> {
  const overrides = await readPowerOfChaosOverrides();
  const override = overrides.find((item) => keyFor(item.name) === keyFor(card.name));
  if (!override) return card;

  return {
    ...card,
    image: override.image ?? card.image,
    artworkImage: override.artworkImage ?? card.artworkImage ?? artworkProxyUrl(card.name),
    type: override.type ?? card.type,
    description: override.description ?? card.description,
    atk: override.atk !== undefined ? override.atk : card.atk,
    def: override.def !== undefined ? override.def : card.def,
    level: override.level !== undefined ? override.level : card.level
  };
}
