import "server-only";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { arabicCardText, normalizeArabicCardTerms, reviewedArabicText } from "./arabicCardText";
import { ARABIC_TRANSLATION_VERSION, finishArabicTranslation, translationSource, translationChunks } from "./arabicTranslationRules";
import { readPowerOfChaosOverrides } from "./powerOfChaosCards";
import { cloudDatabase, usesCloudStorage } from "./cloudDb";
import { readCloudDocument, writeCloudDocument } from "./cloudContent";

const cacheDirectory = path.join(process.cwd(), "data", "translations", "ar");
const cacheSchema = z.object({ source: z.string(), translation: z.string().min(1) });
const responseSchema = z.tuple([
  z.array(z.array(z.unknown())),
]).rest(z.unknown());
const memoryResponseSchema = z.object({
  responseData: z.object({ translatedText: z.string() }),
  responseStatus: z.union([z.number(), z.string()]),
  quotaFinished: z.boolean().optional()
});
const pending = new Map<string, Promise<string>>();
let active = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= 3) await new Promise<void>((resolve) => waiting.push(resolve));
  else active += 1;
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }
}

async function translateWithMyMemory(source: string) {
  const translated: string[] = [];
  for (const chunk of translationChunks(source, 450)) {
    const params = new URLSearchParams({ q: chunk, langpair: "en|ar" });
    const response = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Almaza-Deck-System/1.0" }
    });
    if (!response.ok) throw new Error("Fallback translation is temporarily unavailable.");
    const payload = memoryResponseSchema.parse(await response.json());
    const text = payload.responseData.translatedText.trim();
    if (String(payload.responseStatus) !== "200" || payload.quotaFinished || !text) {
      throw new Error("Fallback translation returned no Arabic text.");
    }
    translated.push(text);
  }
  return translated.join(" ");
}

async function translateWithGoogle(source: string) {
  // Keep long effects intact while staying within the provider's per-request limit.
  const translated: string[] = [];
  for (const chunk of translationChunks(source, 3000)) {
    const params = new URLSearchParams({ client: "gtx", sl: "en", tl: "ar", dt: "t", q: chunk });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error("Card translation is temporarily unavailable.");
    const payload = responseSchema.parse(await response.json());
    const text = payload[0].map((segment) => typeof segment[0] === "string" ? segment[0] : "").join("");
    if (!text.trim()) throw new Error("Empty translation.");
    translated.push(text);
  }
  return translated.join(" ");
}

async function translateRemote(source: string) {
  const prepared = translationSource(source);
  try {
    return normalizeArabicCardTerms(source, finishArabicTranslation(source, await translateWithMyMemory(prepared)));
  } catch {
    return normalizeArabicCardTerms(source, finishArabicTranslation(source, await translateWithGoogle(prepared)));
  }
}

export async function translateCardText(source: string): Promise<string> {
  const reviewed = reviewedArabicText(source);
  if (!source || reviewed) return reviewed ?? source;
  if (!/[a-z]/i.test(source)) return source;
  const key = createHash("sha256").update(`${ARABIC_TRANSLATION_VERSION}:${source}`).digest("hex");
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async () => {
    if (usesCloudStorage) {
      const cached = cacheSchema.safeParse(await readCloudDocument(`translation-ar:${key}`));
      if (cached.success && cached.data.source === source) return normalizeArabicCardTerms(source, cached.data.translation);
      const translation = await withSlot(() => translateRemote(source));
      await writeCloudDocument(`translation-ar:${key}`, { source, translation });
      return translation;
    }
    const file = path.join(cacheDirectory, `${key}.json`);
    try {
      const cached = cacheSchema.safeParse(JSON.parse(await fs.readFile(file, "utf8")));
      if (cached.success && cached.data.source === source) return normalizeArabicCardTerms(source, cached.data.translation);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    const translation = await withSlot(() => translateRemote(source));
    await fs.mkdir(cacheDirectory, { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify({ source, translation }), "utf8");
    await fs.rename(temporary, file);
    return translation;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}

export async function findArabicCardNames(query: string) {
  const normalize = (text: string) => text.replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").trim();
  const needle = normalize(query);
  const names = new Set<string>();
  const addMatch = (source: string, translation: string) => {
    translation = normalizeArabicCardTerms(source, translation);
    if (source.length <= 150 && !/[.\n;]/.test(source) && !/ (Monster|Card|Spell)$/.test(source)
      && normalize(translation).includes(needle)) names.add(source);
  };
  Object.entries(arabicCardText).forEach(([source, translation]) => addMatch(source, translation));
  for (const card of await readPowerOfChaosOverrides()) {
    if (card.nameAr && normalize(card.nameAr).includes(needle)) names.add(card.name);
  }
  if (usesCloudStorage) {
    const rows = await cloudDatabase().appDocument.findMany({ where: { key: { startsWith: "translation-ar:" } } });
    for (const row of rows) {
      const cached = cacheSchema.safeParse(JSON.parse(row.value));
      if (cached.success) addMatch(cached.data.source, cached.data.translation);
    }
    return [...names].slice(0, 24);
  }
  try {
    const files = await fs.readdir(cacheDirectory);
    for (const file of files.filter((name) => name.endsWith(".json"))) {
      const cached = cacheSchema.safeParse(JSON.parse(await fs.readFile(path.join(cacheDirectory, file), "utf8")));
      if (cached.success) addMatch(cached.data.source, cached.data.translation);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return [...names].slice(0, 24);
}
