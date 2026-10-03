export const MAIN_DECK_LIMIT = 60;
export const deckSections = ["MAIN", "EXTRA", "EXTRA_CARDS", "SIDE"] as const;
export type SectionKey = (typeof deckSections)[number];

export function isFusionCard(cardType: string) {
  return cardType.toLowerCase().includes("fusion");
}

export function canCardGoInSection(cardType: string, section: SectionKey) {
  if (isFusionCard(cardType)) return section === "EXTRA" || section === "EXTRA_CARDS";
  return section !== "EXTRA";
}

export function moveDestination(cardType: string, target: SectionKey) {
  return target === "MAIN" && isFusionCard(cardType) ? "EXTRA" : target;
}

type Entry = {
  id: string;
  cardApiId: number;
  cardName: string;
  cardType: string;
  section: string;
  quantity: number;
};

export function planCardMove<T extends Entry>(
  rows: T[], target: SectionKey, selections: Array<{ entryId: string; count: number }>
) {
  const counts = new Map<string, number>();
  for (const selection of selections) {
    counts.set(selection.entryId, (counts.get(selection.entryId) ?? 0) + selection.count);
  }
  let mainCount = rows.filter((row) => row.section === "MAIN").reduce((sum, row) => sum + row.quantity, 0);
  const deckCopies = new Map<number, number>();
  for (const row of rows) {
    if (row.section !== "EXTRA_CARDS") {
      deckCopies.set(row.cardApiId, (deckCopies.get(row.cardApiId) ?? 0) + row.quantity);
    }
  }
  const moves: Array<{ row: T; destination: SectionKey; count: number }> = [];
  const summary = { moved: 0, main: 0, fusion: 0, capacitySkipped: 0, copiesSkipped: 0 };
  for (const row of rows) {
    const requested = Math.max(0, Math.min(counts.get(row.id) ?? 0, row.quantity));
    const destination = moveDestination(row.cardType, target);
    if (!requested || row.section === destination) continue;
    if (!canCardGoInSection(row.cardType, destination)) {
      throw new Error(isFusionCard(row.cardType)
        ? "Fusion monsters can only be placed in the Fusion Deck or Extra Cards."
        : "Only Fusion monsters can be placed in the Fusion Deck.");
    }
    let count = requested;
    if (destination !== "EXTRA_CARDS" && row.section === "EXTRA_CARDS") {
      count = Math.min(count, Math.max(0, 3 - (deckCopies.get(row.cardApiId) ?? 0)));
      summary.copiesSkipped += requested - count;
    }
    if (destination === "MAIN") {
      const available = Math.min(count, Math.max(0, MAIN_DECK_LIMIT - mainCount));
      summary.capacitySkipped += count - available;
      count = available;
    }
    if (!count) continue;
    if (row.section === "MAIN") mainCount -= count;
    if (destination === "MAIN") mainCount += count;
    const deckDelta = destination === "EXTRA_CARDS" ? -count : row.section === "EXTRA_CARDS" ? count : 0;
    deckCopies.set(row.cardApiId, (deckCopies.get(row.cardApiId) ?? 0) + deckDelta);
    moves.push({ row, destination, count });
    summary.moved += count;
    if (destination === "MAIN") summary.main += count;
    if (destination === "EXTRA") summary.fusion += count;
  }
  return { moves, summary };
}
