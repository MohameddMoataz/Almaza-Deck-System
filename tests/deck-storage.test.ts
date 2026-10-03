import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

test("Deck writes enforce capacity and copy limits atomically", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "almaza-deck-test-"));
  process.env.DATABASE_URL = `file:${path.join(directory, "test.db").replaceAll("\\", "/")}`;
  process.env.STORAGE_BACKEND = "sqlite";
  writeFileSync(path.join(directory, "test.db"), "");
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env: process.env, stdio: "pipe" });
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  const { prisma } = await import("../src/lib/db");
  const { addCardToSection, moveCardCopies } = await import("../src/lib/deck");
  const card = (id: number, type = "Normal Monster") => ({ id, name: `Test ${id}`, type, image: "/test.png", description: "Test", atk: 100, def: 100, level: 1 });
  try {
    const owner = await prisma.user.create({ data: { username: "capacity-test", passwordHash: "unused" } });
    for (let id = 1; id <= 20; id++) {
      for (let copy = 0; copy < (id === 20 ? 2 : 3); copy++) await addCardToSection(owner.id, "MAIN", card(id));
    }
    const results = await Promise.allSettled([addCardToSection(owner.id, "MAIN", card(21)), addCardToSection(owner.id, "MAIN", card(22))]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await prisma.deckCard.aggregate({ where: { ownerId: owner.id, section: "MAIN" }, _sum: { quantity: true } }))._sum.quantity, 60);
    await assert.rejects(addCardToSection(owner.id, "MAIN", card(23)), /60 cards/);
    const normal = await addCardToSection(owner.id, "EXTRA_CARDS", card(23));
    const fusion = await addCardToSection(owner.id, "EXTRA_CARDS", card(24, "Fusion Monster"));
    const moved = await moveCardCopies(owner.id, "MAIN", [{ entryId: normal.id, count: 1 }, { entryId: fusion.id, count: 1 }]);
    assert.equal(moved.capacitySkipped, 1);
    assert.equal(moved.fusion, 1);
    assert.equal((await prisma.deckCard.findUnique({ where: { id: normal.id } }))?.quantity, 1);
    await addCardToSection(owner.id, "SIDE", card(25));
    await addCardToSection(owner.id, "SIDE", card(25));
    await addCardToSection(owner.id, "SIDE", card(25));
    await assert.rejects(addCardToSection(owner.id, "SIDE", card(25)), /Maximum 3/);
    await assert.rejects(moveCardCopies(owner.id, "EXTRA", [{ entryId: normal.id, count: 1 }]), /Only Fusion/);
    assert.equal((await prisma.deckCard.findUnique({ where: { id: normal.id } }))?.quantity, 1);
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
