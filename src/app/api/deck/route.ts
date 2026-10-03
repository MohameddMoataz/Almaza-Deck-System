import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { addCardToSection, deckSections, moveCardCopies, removeCardCopies } from "@/lib/deck";
import { prisma } from "@/lib/db";
import { importSavedCardSet } from "@/lib/savedSets";

const cardSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  description: z.string(),
  atk: z.number().nullable(),
  def: z.number().nullable(),
  level: z.number().nullable(),
  image: z.string()
});

const selectionSchema = z.array(
  z.object({
    entryId: z.string(),
    count: z.number().int().positive()
  })
);

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    ownerId: z.string(),
    section: z.enum(deckSections),
    card: cardSchema
  }),
  z.object({
    action: z.literal("move"),
    ownerId: z.string(),
    targetSection: z.enum(deckSections),
    selections: selectionSchema
  }),
  z.object({
    action: z.literal("remove"),
    ownerId: z.string(),
    selections: selectionSchema
  }),
  z.object({
    action: z.literal("importSet"),
    ownerId: z.string(),
    setId: z.string()
  })
]);

async function canEdit(ownerId: string) {
  const user = await getCurrentUser();
  return Boolean(user && (user.id === ownerId || user.role === "ADMIN"));
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid deck request." }, { status: 400 });
  }

  const owner = await prisma.user.findUnique({
    where: { id: parsed.data.ownerId },
    select: { id: true }
  });

  if (!owner) {
    return NextResponse.json({ error: "Deck owner not found." }, { status: 404 });
  }

  if (!(await canEdit(owner.id))) {
    return NextResponse.json({ error: "You do not have permission to edit this deck." }, { status: 403 });
  }

  try {
    if (parsed.data.action === "add") {
      await addCardToSection(owner.id, parsed.data.section, parsed.data.card);
    }

    if (parsed.data.action === "move") {
      const result = await moveCardCopies(owner.id, parsed.data.targetSection, parsed.data.selections);
      return NextResponse.json({ ok: true, ...result });
    }

    if (parsed.data.action === "remove") {
      await removeCardCopies(owner.id, parsed.data.selections);
    }

    if (parsed.data.action === "importSet") {
      const result = await importSavedCardSet(owner.id, parsed.data.setId);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Deck update failed." },
      { status: 400 }
    );
  }
}
