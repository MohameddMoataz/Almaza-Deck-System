import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { translateCardText } from "@/lib/translateCardText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ texts: z.array(z.string().min(1).max(10000)).max(8) });
const requests = new Map<string, { count: number; expires: number }>();

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const now = Date.now();
  for (const [key, value] of requests) if (value.expires <= now) requests.delete(key);
  const client = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const quota = requests.get(client) ?? { count: 0, expires: now + 60000 };
  if (quota.count >= 90) return NextResponse.json({ error: "Please retry shortly." }, { status: 429 });
  quota.count += 1;
  requests.set(client, quota);
  try {
    const body = await request.text();
    if (body.length > 40000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
    const parsed = schema.safeParse(JSON.parse(body));
    if (!parsed.success) return NextResponse.json({ error: "Invalid card text." }, { status: 400 });
    const texts = [...new Set(parsed.data.texts)];
    const results = await Promise.allSettled(texts.map(translateCardText));
    const translations: Record<string, string> = {};
    const failed: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") translations[texts[index]] = result.value;
      else failed.push(texts[index]);
    });
    return NextResponse.json({ translations, failed });
  } catch {
    return NextResponse.json({ error: "Invalid translation request." }, { status: 400 });
  }
}
