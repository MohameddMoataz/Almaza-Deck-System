import { NextRequest, NextResponse } from "next/server";
import { getCardByName, searchCards } from "@/lib/cards";
import { findArabicCardNames } from "@/lib/translateCardText";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";

  try {
    if (/[\u0600-\u06ff]/.test(query) && query.trim().length >= 2) {
      const names = await findArabicCardNames(query);
      const cards = await Promise.all(names.map(getCardByName));
      return NextResponse.json({ cards: cards.filter(Boolean) });
    }
    const cards = await searchCards(query);
    return NextResponse.json({ cards });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Card search failed." },
      { status: 502 }
    );
  }
}
