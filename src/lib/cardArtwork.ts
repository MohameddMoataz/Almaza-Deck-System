export function wikiArtworkFileName(cardName: string) {
  return `${cardName.replace(/[^a-z0-9]/gi, "")}-OW.png`;
}

export function wikiArtworkUrl(cardName: string) {
  const fileName = wikiArtworkFileName(cardName);
  return `https://yugioh.fandom.com/wiki/Special:Redirect/file/${encodeURIComponent(fileName)}`;
}

export function artworkLookupUrl(cardName: string) {
  return `/api/cards/artwork?name=${encodeURIComponent(cardName)}`;
}

export function artworkProxyUrl(cardName: string) {
  return `${artworkLookupUrl(cardName)}&redirect=1`;
}

export function isDirectArtworkUrl(value?: string): value is string {
  return !!value && /^https?:\/\//i.test(value) && !value.includes("Special:Redirect") && !value.includes("/api/cards/artwork");
}

export function croppedArtworkUrl(image: string) {
  const match = image.match(/^https:\/\/images\.ygoprodeck\.com\/images\/cards(?:_small)?\/(\d+)\.jpg/);
  return match ? `https://images.ygoprodeck.com/images/cards_cropped/${match[1]}.jpg` : "";
}
