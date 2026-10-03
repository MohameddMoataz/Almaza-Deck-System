import { DeckCard, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { CardSummary } from "./cards";
import { canCardGoInSection, deckSections, isFusionCard, MAIN_DECK_LIMIT, planCardMove, SectionKey } from "./deckRules";

export { canCardGoInSection, deckSections, isFusionCard } from "./deckRules";
export type { SectionKey } from "./deckRules";

export const sectionLabels: Record<SectionKey, string> = {
  MAIN: "Main Deck",
  EXTRA: "Fusion Deck",
  SIDE: "Side Deck",
  EXTRA_CARDS: "Extra Cards"
};

export type DeckWithOwner = Prisma.UserGetPayload<{
  select: {
    id: true;
    username: true;
    role: true;
    deckCards: {
      orderBy: [{ section: "asc" }, { cardName: "asc" }];
    };
  };
}>;

export async function getDeckByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      role: true,
      deckCards: {
        orderBy: [{ section: "asc" }, { cardName: "asc" }]
      }
    }
  });
}

export function groupBySection(cards: DeckCard[]) {
  return deckSections.reduce<Record<SectionKey, DeckCard[]>>(
    (acc, section) => {
      acc[section] = cards.filter((card) => card.section === section);
      return acc;
    },
    { MAIN: [], EXTRA: [], SIDE: [], EXTRA_CARDS: [] }
  );
}

export function totalCopies(cards: Array<{ quantity: number }>) {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

async function editDeck<T>(ownerId: string, edit: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    // Lock the owner before reading counts so simultaneous requests cannot exceed limits.
    await tx.user.update({ where: { id: ownerId }, data: { id: ownerId } });
    return edit(tx);
  }, { maxWait: 10000, timeout: 20000 });
}

export async function addCardToSection(ownerId: string, section: SectionKey, card: CardSummary) {
  if (!canCardGoInSection(card.type, section)) {
    throw new Error(
      isFusionCard(card.type)
        ? "Fusion monsters can only be placed in the Fusion Deck or Extra Cards."
        : "Only Fusion monsters can be placed in the Fusion Deck."
    );
  }

  return editDeck(ownerId, async (tx) => {
    const rows = await tx.deckCard.findMany({ where: { ownerId } });
    if (section === "MAIN" && totalCopies(rows.filter((row) => row.section === "MAIN")) >= MAIN_DECK_LIMIT) {
      throw new Error("Main Deck cannot contain more than 60 cards.");
    }
    const currentCopies = totalCopies(rows.filter((row) => row.cardApiId === card.id && row.section !== "EXTRA_CARDS"));
    if (section !== "EXTRA_CARDS" && currentCopies >= 3) {
      throw new Error("Maximum 3 copies of this card allowed in deck sections.");
    }

    return tx.deckCard.upsert({
      where: {
        ownerId_section_cardApiId: {
          ownerId,
          section,
          cardApiId: card.id
        }
      },
      update: { quantity: { increment: 1 } },
      create: {
        ownerId,
        section,
        cardApiId: card.id,
        cardName: card.name,
        cardImage: card.image,
        cardType: card.type,
        description: card.description,
        atk: card.atk,
        def: card.def,
        level: card.level,
        quantity: 1
      }
    });
  });
}

export async function moveCardCopies(
  ownerId: string,
  targetSection: SectionKey,
  selections: Array<{ entryId: string; count: number }>
) {
  return editDeck(ownerId, async (tx) => {
    const rows = await tx.deckCard.findMany({ where: { ownerId }, orderBy: [{ cardName: "asc" }, { id: "asc" }] });
    const { moves, summary } = planCardMove(rows, targetSection, selections);
    for (const { row, destination, count: movingCount } of moves) {
      await tx.deckCard.upsert({
        where: {
          ownerId_section_cardApiId: {
            ownerId,
            section: destination,
            cardApiId: row.cardApiId
          }
        },
        update: { quantity: { increment: movingCount } },
        create: {
          ownerId,
          section: destination,
          cardApiId: row.cardApiId,
          cardName: row.cardName,
          cardImage: row.cardImage,
          cardType: row.cardType,
          description: row.description,
          atk: row.atk,
          def: row.def,
          level: row.level,
          quantity: movingCount
        }
      });

      if (row.quantity === movingCount) {
        await tx.deckCard.delete({ where: { id: row.id } });
      } else {
        await tx.deckCard.update({
          where: { id: row.id },
          data: { quantity: { decrement: movingCount } }
        });
      }
    }
    return summary;
  });
}

export async function removeCardCopies(
  ownerId: string,
  selections: Array<{ entryId: string; count: number }>
) {
  return editDeck(ownerId, async (tx) => {
    const sourceRows = await tx.deckCard.findMany({
      where: {
        ownerId,
        id: { in: selections.map((selection) => selection.entryId) }
      }
    });
    const countById = new Map(selections.map((selection) => [selection.entryId, selection.count]));

    for (const row of sourceRows) {
      const requested = countById.get(row.id) ?? 0;
      const removingCount = Math.max(0, Math.min(requested, row.quantity));
      if (!removingCount) continue;

      if (row.quantity === removingCount) {
        await tx.deckCard.delete({ where: { id: row.id } });
      } else {
        await tx.deckCard.update({
          where: { id: row.id },
          data: { quantity: { decrement: removingCount } }
        });
      }
    }
  });
}
