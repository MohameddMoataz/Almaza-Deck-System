import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCardByName } from "@/lib/cards";

const bodySchema = z.object({
  names: z.array(z.string().min(1)).max(120)
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid card names." }, { status: 400 });
  }

  const uniqueNames = [...new Set(parsed.data.names.map((name) => name.trim()).filter(Boolean))];
  const cards = [];
  const missing = [];

  for (const name of uniqueNames) {
    const card = await getCardByName(name);
    if (card) {
      cards.push(card);
    } else {
      missing.push(name);
    }
  }

  return NextResponse.json({ cards, missing });
}
