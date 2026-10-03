import assert from "node:assert/strict";
import { test } from "node:test";
import { planCardMove } from "../src/lib/deckRules";

function entry(id: string, type = "Effect Monster", section = "EXTRA_CARDS", quantity = 1, cardApiId = Number(id)) {
  return { id, cardApiId, cardName: `Card ${id}`, cardType: type, section, quantity };
}

test("Move to Main sorts a mixed selection, including spells and traps", () => {
  const rows = [entry("1"), entry("2", "Fusion Monster"), entry("3", "Spell Card"), entry("4", "Trap Card")];
  const { moves, summary } = planCardMove(rows, "MAIN", rows.map((row) => ({ entryId: row.id, count: 1 })));
  assert.deepEqual(moves.map((move) => move.destination), ["MAIN", "EXTRA", "MAIN", "MAIN"]);
  assert.equal(summary.main, 3);
  assert.equal(summary.fusion, 1);
});

test("Main stops at 60 while Fusion still moves and excess copies stay put", () => {
  const rows = [entry("1", "Normal Monster", "MAIN", 59), entry("2", "Effect Monster", "EXTRA_CARDS", 3), entry("3", "Fusion Monster")];
  const { moves, summary } = planCardMove(rows, "MAIN", [{ entryId: "2", count: 3 }, { entryId: "3", count: 1 }]);
  assert.deepEqual(moves.map((move) => move.count), [1, 1]);
  assert.equal(summary.capacitySkipped, 2);
  assert.equal(summary.fusion, 1);
});

test("Copy limit counts Main, Side and Fusion together", () => {
  const rows = [entry("1", "Normal Monster", "SIDE", 2, 42), entry("2", "Normal Monster", "EXTRA_CARDS", 4, 42)];
  const { moves, summary } = planCardMove(rows, "MAIN", [{ entryId: "2", count: 4 }]);
  assert.equal(moves[0].count, 1);
  assert.equal(summary.copiesSkipped, 3);
});

test("Moving existing Side copies to Main does not double-count them", () => {
  const rows = [entry("1", "Normal Monster", "MAIN", 1, 42), entry("2", "Normal Monster", "SIDE", 2, 42)];
  assert.equal(planCardMove(rows, "MAIN", [{ entryId: "2", count: 2 }]).summary.main, 2);
});

test("No-op, missing entries and repeated selections cannot duplicate cards", () => {
  const rows = [entry("1", "Normal Monster", "MAIN"), entry("2")];
  const { summary } = planCardMove(rows, "MAIN", [
    { entryId: "1", count: 1 }, { entryId: "2", count: 10 }, { entryId: "2", count: 10 }, { entryId: "missing", count: 100 }
  ]);
  assert.equal(summary.moved, 1);
});

test("Fusion rejects other types, Side rejects Fusion, and storage has no copy cap", () => {
  assert.throws(() => planCardMove([entry("1")], "EXTRA", [{ entryId: "1", count: 1 }]));
  assert.throws(() => planCardMove([entry("1", "Fusion Monster")], "SIDE", [{ entryId: "1", count: 1 }]));
  const rows = [entry("1", "Normal Monster", "MAIN", 3), entry("2", "Normal Monster", "EXTRA_CARDS", 10, 1)];
  assert.equal(planCardMove(rows, "EXTRA_CARDS", [{ entryId: "1", count: 3 }]).summary.moved, 3);
});
