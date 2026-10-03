import assert from "node:assert/strict";
import test from "node:test";
import { reviewedArabicText, normalizeArabicCardTerms } from "../src/lib/arabicCardText";
import { arabicReviewedEffects } from "../src/lib/arabicReviewedEffects";
import { translationSource, finishArabicTranslation, translationChunks, ARABIC_TRANSLATION_VERSION } from "../src/lib/arabicTranslationRules";

test("prepared effects match CRLF and smart quotes without network calls", () => {
  for (const [source, translation] of Object.entries(arabicReviewedEffects)) {
    assert.equal(reviewedArabicText(source), translation);
    assert.equal(reviewedArabicText(source.replace(/\n/g, "\r\n").replace(/"/g, "“")), translation);
  }
});

test("templates reflect changed stats and attributes rather than reuse stale text", () => {
  assert.match(reviewedArabicText("Equip only to a FIRE monster. It gains 900 ATK.")!, /900/);
  assert.match(reviewedArabicText("Equip only to a WATER monster. It gains 700 ATK.")!, /الماء/);
  assert.equal(reviewedArabicText("Equip only to a FIRE monster. It loses 700 ATK."), undefined);
});

test("unknown clauses never receive a partial prepared translation", () => {
  assert.equal(reviewedArabicText("Draw 3 cards. Skip your next turn."), undefined);
});

test("coin call means prediction, not summoning", () => {
  const text = translationSource("Toss a coin and call it. If you call it right, draw 2 cards. If you call it wrong, skip your next turn.");
  assert.match(text, /predict heads or tails/);
  assert.match(text, /if your prediction is correct/);
  assert.match(text, /if your prediction is incorrect/);
  assert.equal(translationSource("Call it a powerful monster."), "Call it a powerful monster.");
});

test("die disambiguation is limited to dice effects", () => {
  assert.equal(translationSource("Roll a six-sided die."), "Roll a six-sided dice.");
  assert.equal(translationSource("Heroes never die."), "Heroes never die.");
});

test("quoted names and PSCT punctuation are never rewritten", () => {
  const source = 'Tribute 1 monster; add "Torrential Tribute" to your hand. Once per turn: You can draw 2 cards.';
  const result = translationSource(source);
  assert.ok(result.includes('"Torrential Tribute"'));
  assert.equal((result.match(/[;:]/g) ?? []).join(""), ";:");
  assert.ok(result.includes("You can"));
  assert.ok(result.includes("Once per turn"));
});

test("send, discard, destroy, banish and negation remain distinct in source", () => {
  const source = "Discard; destroy; send; banish; negate the activation; negate the effect; then; and if you do; also.";
  assert.equal(translationSource(source), source);
});

test("equip templates keep recipient, stat and duration", () => {
  const text = reviewedArabicText("Target 1 face-up monster you control; equip this card to that target. It gains 600 ATK until the end of this turn.")!;
  for (const term of ["تتحكم به", "جهّزه بهذه البطاقة", "الهجوم", "600", "حتى نهاية هذا الدور"]) assert.ok(text.includes(term));
  assert.ok(!reviewedArabicText("Target 1 face-down monster you control; equip this card to that target. It gains 600 ATK."));
});

test("dice templates retain gain/loss, controller and multiplier", () => {
  const result = reviewedArabicText("Roll a six-sided die. All monsters your opponent currently controls lose ATK/DEF equal to the result x 200, until the end of this turn.")!;
  for (const term of ["نرد", "تنخفض", "خصمك", "200", "دفاع"]) assert.ok(result.includes(term), term);
});

test("changed or missing statistics and non-Arabic responses are rejected", () => {
  assert.throws(() => finishArabicTranslation("Gain 700 LP.", "استعد 900 نقطة حياة."));
  assert.throws(() => finishArabicTranslation("Gain 700 LP.", "استعد نقاط حياة."));
  assert.throws(() => finishArabicTranslation("Draw 2 cards.", "Draw 2 cards."));
  assert.equal(finishArabicTranslation("Gain 700 LP.", "استعد ٧٠٠ نقطة حياة."), "استعد 700 نقطة حياة.");
});

test("Arabic inflections for one and two cards remain accepted", () => {
  assert.equal(finishArabicTranslation("Draw 2 cards.", "اسحب بطاقتين."), "اسحب بطاقتين.");
});

test("machine corrections are source-gated", () => {
  assert.equal(finishArabicTranslation("Draw 2 cards.", "ارسم بطاقتين."), "اسحب بطاقتين.");
  assert.equal(finishArabicTranslation("Draw a portrait.", "ارسم صورة."), "ارسم صورة.");
  assert.equal(finishArabicTranslation("A painted portrait.", "ارسم صورة."), "ارسم صورة.");
  assert.equal(normalizeArabicCardTerms("Tribute 1 monster.", "التكريم"), "التضحية");
});

test("UTF-8 chunks fit provider limits without losing text", () => {
  const source = ("Draw 2 cards, then send 1 card to the GY.\n").repeat(30);
  const chunks = translationChunks(source, 450);
  assert.equal(chunks.join(""), source);
  for (const chunk of chunks) assert.ok(Buffer.byteLength(chunk, "utf8") <= 450);
  for (const chunk of translationChunks("بطاقة ".repeat(100), 450)) assert.ok(Buffer.byteLength(chunk) <= 450);
});

test("pipeline version invalidates old machine caches", () => {
  assert.notEqual(ARABIC_TRANSLATION_VERSION, "v1");
});
