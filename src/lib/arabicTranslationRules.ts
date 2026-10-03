export const ARABIC_TRANSLATION_VERSION = "game-context-v2";

// Preserve sentence grammar and never rewrite quoted card identifiers.
export function translationSource(source: string) {
  const coinEffect = /\bcoin\b/i.test(source);
  const diceEffect = /\b(?:roll|rolled|rolling|dice)\b/i.test(source);
  return source.split(/("[^"\n]*"|“[^”\n]*”)/g).map((part, index) => {
    if (index % 2) return part;
    let text = part
      .replace(/\bTribute Summon(ed|ing)?\b/gi, (_, suffix: string | undefined) => "Summon" + (suffix ?? "") + " by sacrifice")
      .replace(/\bTributing\b/gi, "sacrificing")
      .replace(/\bTributes\b/gi, "sacrifices")
      .replace(/\bTribute\b/gi, "sacrifice")
      .replace(/\bGY\b/g, "Graveyard");
    if (coinEffect) text = text
      .replace(/\bif you call it right\b/gi, "if your prediction is correct")
      .replace(/\bif you call it wrong\b/gi, "if your prediction is incorrect")
      .replace(/\bcall it right\b/gi, "make a correct prediction")
      .replace(/\bcall it wrong\b/gi, "make an incorrect prediction")
      .replace(/\bcall (?:it|heads or tails)\b/gi, "predict heads or tails");
    if (diceEffect) text = text.replace(/\bdie\b/gi, "dice");
    return text;
  }).join("");
}

export function finishArabicTranslation(source: string, translation: string) {
  if (!/[\u0621-\u064a]/.test(translation)) throw new Error("Translation returned no Arabic text.");
  let result = translation.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  // 1 and 2 are commonly inflected words in Arabic. This catches changed
  // statistics, not every possible semantic error in machine translation.
  const numbers = (text: string) => (text.match(/\b\d+(?:[.,]\d+)*\b/g) ?? [])
    .map((n) => n.replace(/,/g, "")).filter((n) => ![1, 2].includes(Number(n))).sort();
  if (JSON.stringify(numbers(source)) !== JSON.stringify(numbers(result))) {
    throw new Error("Translation changed a card statistic or quantity.");
  }
  if (/\bdraw(?:s|n|ing)?\b[^.!?;]*\bcards?\b/i.test(source)) result = result.replace(/ارسم|إرسم/g, "اسحب");
  if (/\bdeck\b/i.test(source)) result = result.replace(/سطح السفينة/g, "المجموعة");
  if (/\bfusion\b/i.test(source)) result = result.replace(/الفيوجن|الاندماج/g, "الدمج");
  if (/\bcoin\b/i.test(source)) result = result
    .replace(/الرؤوس أو ذيولها|الرؤوس أو الذيول|رؤوس أو ذيول|الرأس أو الذيل/g, "صورة أو كتابة")
    .replace(/تنبؤك/g, "توقّعك");
  if (/\bequip(?:ped|s|ment)?\b/i.test(source)) result = result
    .replace(/بطاقة المعدات|بطاقة معدات/g, "بطاقة تجهيز");
  return result.trim();
}

// MyMemory limits UTF-8 bytes, not characters. Never split a word.
export function translationChunks(source: string, byteLimit: number): string[] {
  const chunks: string[] = [];
  let chunk = "";
  for (const word of source.match(/\S+\s*/g) ?? []) {
    if (new TextEncoder().encode(word).length > byteLimit) throw new Error("Translation word exceeds provider limit.");
    if (new TextEncoder().encode(chunk + word).length > byteLimit) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += word;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
