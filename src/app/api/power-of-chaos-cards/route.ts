import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { readPowerOfChaosOverrides, updatePowerOfChaosOverride } from "@/lib/powerOfChaosCards";

export const dynamic = "force-dynamic";

const overrideSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().max(200).optional(),
  descriptionAr: z.string().max(10000).optional(),
  image: z.string().optional(),
  artworkImage: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  atk: z.number().int().nullable().optional(),
  def: z.number().int().nullable().optional(),
  level: z.number().int().nullable().optional()
});

export async function GET() {
  const cards = await readPowerOfChaosOverrides();
  return NextResponse.json({ cards });
}

export async function PUT(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = overrideSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Power of Chaos card data." }, { status: 400 });
  }

  try {
    const card = await updatePowerOfChaosOverride(parsed.data);
    return NextResponse.json({ card });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update card data." },
      { status: 400 }
    );
  }
}
