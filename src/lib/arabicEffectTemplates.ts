// Only complete, known structures match. Unknown clauses remain machine-translated
// as a whole, rather than assembling fragments that could change a rule.
const attributes: Record<string, string> = { FIRE: "النار", WATER: "الماء", WIND: "الرياح", EARTH: "الأرض", LIGHT: "النور", DARK: "الظلام", DIVINE: "الإلهية" };
const races: Record<string, string> = { Warrior: "المحارب", Dragon: "التنين", Spellcaster: "الساحر", Machine: "الآلة", Fiend: "الشيطان", Fairy: "الجنية", Zombie: "الزومبي", Beast: "الوحش البري" };
const stats: Record<string, string> = { ATK: "الهجوم", DEF: "الدفاع", "ATK/DEF": "الهجوم والدفاع" };

export function translateEffectTemplate(source: string): string | undefined {
  const text = source.replace(/\s+/g, " ").trim();
  let match: RegExpMatchArray | null;
  if ((match = text.match(/^Equip only to a ([A-Z]+) monster\. It gains (\d+) (ATK|DEF|ATK\/DEF)\.$/)) && attributes[match[1]]) {
    return `لا تُجهَّز هذه البطاقة إلا لوحش من سمة ${attributes[match[1]]} (${match[1]}). تزداد نقاط ${stats[match[3]]} للوحش المجهَّز بها بمقدار ${match[2]}.`;
  }
  if ((match = text.match(/^Equip only to a ([A-Za-z]+)(?:-Type)? monster\. It gains (\d+) (ATK|DEF|ATK\/DEF)\.$/)) && races[match[1]]) {
    return `لا تُجهَّز هذه البطاقة إلا لوحش من نوع ${races[match[1]]}. تزداد نقاط ${stats[match[3]]} للوحش المجهَّز بها بمقدار ${match[2]}.`;
  }
  if ((match = text.match(/^Target 1 face-up monster (you control|on the field); equip this card to that target\. It gains (\d+) (ATK|DEF|ATK\/DEF)( until the end of this turn)?\.$/))) {
    return `استهدف وحشًا مكشوفًا ${match[1] === "you control" ? "تتحكم به" : "في الملعب"}؛ جهّزه بهذه البطاقة. تزداد نقاط ${stats[match[3]]} للوحش بمقدار ${match[2]}${match[4] ? " حتى نهاية هذا الدور" : ""}.`;
  }
  if ((match = text.match(/^Roll a six-sided die\. All monsters (you currently control|your opponent currently controls) (gain|lose) ATK\/DEF equal to the result x (\d+), until the end of this turn\.$/))) {
    return `ارمِ حجر نرد سداسي الأوجه. ${match[2] === "gain" ? "تزداد" : "تنخفض"} نقاط هجوم ودفاع جميع الوحوش التي ${match[1] === "you currently control" ? "تتحكم بها" : "يتحكم بها خصمك"} حاليًا بمقدار نتيجة الرمية × ${match[3]}، حتى نهاية هذا الدور.`;
  }
  if ((match = text.match(/^Draw (\d+) cards?\.$/))) return `اسحب ${match[1]} من البطاقات.`;
  if ((match = text.match(/^Gain (\d+) (?:LP|Life Points)\.$/))) return `استعد ${match[1]} نقطة حياة.`;
  if ((match = text.match(/^Inflict (\d+) damage to your opponent\.$/))) return `ألحق بخصمك ${match[1]} نقطة ضرر.`;
  if ((match = text.match(/^You can discard 1 card; (?:toss|Toss) a coin and call it\. If you call it right, draw (\d+) cards?\.$/))) {
    return `يمكنك التخلص من بطاقة واحدة من يدك؛ ارمِ عملة وتوقّع النتيجة (صورة أو كتابة). إذا صحّ توقّعك، اسحب ${match[1]} من البطاقات.`;
  }
  if ((match = text.match(/^Roll a six-sided die\. If the result is ([1-6]) or (more|less), destroy 1 card on the field\.$/))) {
    return `ارمِ حجر نرد سداسي الأوجه. إذا كانت النتيجة ${match[1]} أو ${match[2] === "more" ? "أكثر" : "أقل"}، دمّر بطاقة واحدة في الملعب.`;
  }
  return undefined;
}
