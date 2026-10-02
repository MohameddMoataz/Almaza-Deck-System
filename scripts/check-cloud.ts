import assert from "node:assert/strict";
import { cloudDatabase } from "../src/lib/cloudDb";
import { readSavedCardSets, updateSavedCardSet } from "../src/lib/savedSets";
import { readPowerOfChaosOverrides, updatePowerOfChaosOverride } from "../src/lib/powerOfChaosCards";
import { readCloudDocument, writeCloudDocument } from "../src/lib/cloudContent";
import { canCardGoInSection } from "../src/lib/deck";

async function main() {
  if (new URL(process.env.DATABASE_URL ?? "").pathname !== "/almaza_test") {
    throw new Error("This check only runs against the disposable almaza_test database.");
  }
  const db = cloudDatabase();
  try {
    const sets = await readSavedCardSets();
    assert.ok(sets.length >= 2, "Both starter sets are seeded");
    const editedSet = { ...sets[0], name: "Cloud persistence check" };
    await updateSavedCardSet(editedSet);
    assert.equal((await readSavedCardSets()).find((set) => set.id === editedSet.id)?.name, editedSet.name);
    await updateSavedCardSet(sets[0]);
    const override = { name: "Cloud test card", nameAr: "بطاقة اختبار", description: "Test effect", descriptionAr: "تأثير اختبار" };
    await updatePowerOfChaosOverride(override);
    assert.equal((await readPowerOfChaosOverrides()).find((card) => card.name === override.name)?.descriptionAr, override.descriptionAr);
    await writeCloudDocument("translation-ar:test", { source: "Test", translation: "اختبار" });
    assert.deepEqual(await readCloudDocument("translation-ar:test"), { source: "Test", translation: "اختبار" });
    const user = await db.user.create({ data: { username: "cloud-check-player", passwordHash: "test-only", role: "USER" } });
    await db.deckCard.create({ data: {
      ownerId: user.id, section: "MAIN", cardApiId: 123, cardName: "Test card", cardImage: "", cardType: "Normal Monster", description: "Test"
    } });
    await db.user.delete({ where: { id: user.id } });
    assert.equal(await db.deckCard.count({ where: { ownerId: user.id } }), 0, "User deletion cascades to decks");
    assert.equal(canCardGoInSection("Fusion Monster", "MAIN"), false);
    assert.equal(canCardGoInSection("Normal Monster", "EXTRA"), false);
    await db.appDocument.deleteMany({ where: { key: { in: ["card-override:cloud test card", "translation-ar:test"] } } });
    console.log("PASS: PostgreSQL storage, saved-set edits, Arabic overrides/cache, user/deck deletion, and placement rules.");
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
