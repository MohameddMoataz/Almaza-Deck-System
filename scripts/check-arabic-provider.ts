import { finishArabicTranslation, translationSource, translationChunks } from "../src/lib/arabicTranslationRules";

// Optional live smoke check; does not read or write card/database content.
async function main() {
  for (const source of [
    "You can discard 1 card; toss a coin and call it. If you call it right, draw 2 cards.",
    "Target 1 face-up monster you control; equip this card to that target. It gains 600 ATK until the end of this turn.",
    "Roll a six-sided die. If the result is 3 or more, destroy 1 card on the field."
  ]) {
    const translated: string[] = [];
    for (const chunk of translationChunks(translationSource(source), 450)) {
      const params = new URLSearchParams({ q: chunk, langpair: "en|ar" });
      const response = await fetch(`https://api.mymemory.translated.net/get?${params}`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Provider returned ${response.status}`);
      const data = await response.json();
      if (String(data.responseStatus) !== "200") throw new Error("Provider quota or translation error");
      translated.push(data.responseData.translatedText);
    }
    console.log(source);
    console.log(finishArabicTranslation(source, translated.join(" ")));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
