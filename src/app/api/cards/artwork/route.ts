import { NextRequest, NextResponse } from "next/server";
import { wikiArtworkFileName } from "@/lib/cardArtwork";

export const dynamic = "force-dynamic";

type WikiImageInfoResponse = {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: Array<{
          url?: string;
        }>;
      }
    >;
  };
};

async function resolveArtworkUrl(fileName: string, name: string | null) {
  const stems = name ? [
    name.replace(/[^a-z0-9-]/gi, ""),
    name.replace(/[^a-z0-9]/gi, ""),
    name.replace(/[^a-z0-9'-]/gi, ""),
    name.replace(/^The /i, "").replace(/[^a-z0-9-]/gi, "")
  ] : [];
  const files = [...new Set([fileName, ...stems.flatMap(stem => [`${stem}-OW.png`, `${stem}-OW.jpg`])])];
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    titles: files.map(file => `File:${file}`).join("|"),
    prop: "imageinfo",
    iiprop: "url"
  });

  try {
    const response = await fetch(`https://yugioh.fandom.com/api.php?${params}`, {
      next: { revalidate: 60 * 60 * 24 * 7 },
      signal: AbortSignal.timeout(7000)
    });
    if (response.ok) {
      const payload = (await response.json()) as WikiImageInfoResponse;
      const url = Object.values(payload.query?.pages ?? {}).flatMap(page => page.imageinfo ?? [])
        .map(info => info.url).find(url => url?.startsWith("https://static.wikia.nocookie.net/"));
      if (url) return url;
    }
  } catch { /* Continue to the artwork-only fallback if the Wiki is unavailable. */ }

  if (!name) return null;
  try {
    const response = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`, {
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.data?.[0]?.card_images?.[0]?.image_url_cropped ?? null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");
  const file = request.nextUrl.searchParams.get("file");
  const redirect = request.nextUrl.searchParams.get("redirect") === "1";
  const fileName = file || (name ? wikiArtworkFileName(name) : "");

  if (!fileName) {
    return NextResponse.json({ artworkImage: null, error: "Card name is required." }, { status: 400 });
  }

  const artworkImage = await resolveArtworkUrl(fileName, name);

  if (redirect) {
    if (!artworkImage) return new NextResponse("Artwork not found.", { status: 404 });
    return NextResponse.redirect(artworkImage, { status: 302 });
  }

  return NextResponse.json({ artworkImage, fileName });
}
