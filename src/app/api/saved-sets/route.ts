import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { readSavedCardSets, updateSavedCardSet } from "@/lib/savedSets";

export const dynamic = "force-dynamic";

const savedSetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  cards: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().int().positive().optional()
    })
  )
});

export async function GET() {
  const savedSets = await readSavedCardSets();
  return NextResponse.json({ savedSets });
}

export async function PUT(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = savedSetSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid saved set." }, { status: 400 });
  }

  try {
    const savedSet = await updateSavedCardSet(parsed.data);
    return NextResponse.json({ savedSet });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update saved set." },
      { status: 400 }
    );
  }
}
