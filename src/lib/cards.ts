import { z } from "zod";
import { get } from "https";
import { artworkProxyUrl } from "./cardArtwork";
import { applyPowerOfChaosOverride } from "./powerOfChaosCards";

export type CardSummary = {
  id: number;
  name: string;
  type: string;
  description: string;
  atk: number | null;
  def: number | null;
  level: number | null;
  image: string;
  artworkImage?: string;
};

const cardSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string().default("Unknown"),
  desc: z.string().default(""),
  atk: z.number().optional(),
  def: z.number().optional(),
  level: z.number().optional(),
  card_images: z
    .array(
      z.object({
        image_url: z.string()
      })
    )
    .default([])
});

function normalizeCard(card: z.infer<typeof cardSchema>): CardSummary {
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    description: card.desc,
    atk: card.atk ?? null,
    def: card.def ?? null,
    level: card.level ?? null,
    image: card.card_images[0]?.image_url ?? "",
    artworkImage: artworkProxyUrl(card.name)
  };
}

async function fetchCardPayload(url: string) {
  try {
    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 }
    });

    if (response.status === 400) return { data: [] };
    if (!response.ok) throw new Error("Unable to search cards right now.");

    return (await response.json()) as { data?: unknown[] };
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;

    return new Promise<{ data?: unknown[] }>((resolve, reject) => {
      const request = get(url, { rejectUnauthorized: false }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode === 400) {
            resolve({ data: [] });
            return;
          }

          if (!response.statusCode || response.statusCode >= 400) {
            reject(new Error("Unable to search cards right now."));
            return;
          }

          try {
            resolve(JSON.parse(body) as { data?: unknown[] });
          } catch {
            reject(new Error("Unable to read card search results."));
          }
        });
      });

      request.on("error", reject);
      request.end();
    });
  }
}

export async function searchCards(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({ fname: trimmed, num: "24", offset: "0" });
  const payload = await fetchCardPayload(`https://db.ygoprodeck.com/api/v7/cardinfo.php?${params}`);

  const cards = (payload.data ?? [])
    .map((card) => cardSchema.safeParse(card))
    .filter((result): result is z.SafeParseSuccess<z.infer<typeof cardSchema>> => result.success)
    .map((result) => normalizeCard(result.data));

  return Promise.all(cards.map((card) => applyPowerOfChaosOverride(card)));
}

export async function getCardByName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({ name: trimmed });
  const payload = await fetchCardPayload(`https://db.ygoprodeck.com/api/v7/cardinfo.php?${params}`);
  const parsed = cardSchema.safeParse(payload.data?.[0]);

  return parsed.success ? applyPowerOfChaosOverride(normalizeCard(parsed.data)) : null;
}
