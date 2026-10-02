import { DeckCard, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { CardSummary } from "./cards";

export const deckSections = ["MAIN", "EXTRA", "EXTRA_CARDS", "SIDE"] as const;
export type SectionKey = (typeof deckSections)[number];

export const sectionLabels: Record<SectionKey, string> = {
  MAIN: "Main Deck",
  EXTRA: "Fusion Deck",
  SIDE: "Side Deck",
  EXTRA_CARDS: "Extra Cards"
};

export function isFusionCard(cardType: string) {
  return cardType.toLowerCase().includes("fusion");
}

export function canCardGoInSection(cardType: string, section: SectionKey) {
  const fusion = isFusionCard(cardType);
  if (fusion) return section === "EXTRA" || section === "EXTRA_CARDS";
  return section !== "EXTRA";
}

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

async function countDeckCopies(ownerId: string, cardApiId: number) {
  const rows = await prisma.deckCard.findMany({
    where: {
      ownerId,
      cardApiId,
      section: { in: ["MAIN", "EXTRA", "SIDE"] }
    },
    select: { quantity: true }
  });

  return rows.reduce((sum, row) => sum + row.quantity, 0);
}

export async function addCardToSection(ownerId: string, section: SectionKey, card: CardSummary) {
  if (!canCardGoInSection(card.type, section)) {
    throw new Error(
      isFusionCard(card.type)
        ? "Fusion monsters can only be placed in the Fusion Deck or Extra Cards."
        : "Only Fusion monsters can be placed in the Fusion Deck."
    );
  }

  if (section !== "EXTRA_CARDS") {
    const currentCopies = await countDeckCopies(ownerId, card.id);
    if (currentCopies >= 3) {
      throw new Error("Maximum 3 copies of this card allowed in deck sections.");
    }
  }

  return prisma.deckCard.upsert({
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
}

export async function moveCardCopies(
  ownerId: string,
  targetSection: SectionKey,
  selections: Array<{ entryId: string; count: number }>
) {
  const sourceRows = await prisma.deckCard.findMany({
    where: {
      ownerId,
      id: { in: selections.map((selection) => selection.entryId) }
    }
  });

  const countById = new Map(selections.map((selection) => [selection.entryId, selection.count]));

  const invalidTarget = sourceRows.find((row) => {
    const requested = countById.get(row.id) ?? 0;
    return requested > 0 && row.section !== targetSection && !canCardGoInSection(row.cardType, targetSection);
  });

  if (invalidTarget) {
    throw new Error(
      isFusionCard(invalidTarget.cardType)
        ? `${invalidTarget.cardName} is a Fusion monster and can only be placed in the Fusion Deck or Extra Cards.`
        : `${invalidTarget.cardName} is not a Fusion monster and cannot be placed in the Fusion Deck.`
    );
  }

  for (const row of sourceRows) {
    const requested = countById.get(row.id) ?? 0;
    const movingCount = Math.max(0, Math.min(requested, row.quantity));
    if (!movingCount || row.section === targetSection) continue;

    if (targetSection !== "EXTRA_CARDS") {
      const existingCopies = await countDeckCopies(ownerId, row.cardApiId);
      const leavingDeck = row.section !== "EXTRA_CARDS" ? movingCount : 0;
      if (existingCopies - leavingDeck + movingCount > 3) {
        throw new Error(`Maximum 3 copies of ${row.cardName} allowed in deck sections.`);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.deckCard.upsert({
        where: {
          ownerId_section_cardApiId: {
            ownerId,
            section: targetSection,
            cardApiId: row.cardApiId
          }
        },
        update: { quantity: { increment: movingCount } },
        create: {
          ownerId,
          section: targetSection,
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
    });
  }
}

export async function removeCardCopies(
  ownerId: string,
  selections: Array<{ entryId: string; count: number }>
) {
  const sourceRows = await prisma.deckCard.findMany({
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
      await prisma.deckCard.delete({ where: { id: row.id } });
    } else {
      await prisma.deckCard.update({
        where: { id: row.id },
        data: { quantity: { decrement: removingCount } }
      });
    }
  }
}
