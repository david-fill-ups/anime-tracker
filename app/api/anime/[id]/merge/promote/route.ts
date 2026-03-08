import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

type Params = { params: Promise<{ id: string }> };

// POST { secondaryId } — promote a merged season to become the new primary
export async function POST(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id } = await params;
  const oldPrimaryId = Number(id);
  const { secondaryId } = await req.json() as { secondaryId: number };

  if (!secondaryId || typeof secondaryId !== "number") {
    return NextResponse.json({ error: "secondaryId required" }, { status: 400 });
  }

  // Verify caller has the current primary in their library
  const primaryEntry = await db.userEntry.findFirst({ where: { animeId: oldPrimaryId, userId } });
  if (!primaryEntry) {
    return NextResponse.json({ error: "Not in your library" }, { status: 403 });
  }

  // Verify the secondary is actually merged into this primary
  const secondary = await db.anime.findUnique({ where: { id: secondaryId } });
  if (!secondary || secondary.mergedIntoId !== oldPrimaryId) {
    return NextResponse.json({ error: "Not a merged season of this anime" }, { status: 400 });
  }

  // Get all current merged seasons (excluding the one being promoted)
  const otherSecondaries = await db.anime.findMany({
    where: { mergedIntoId: oldPrimaryId, id: { not: secondaryId } },
    orderBy: { mergeOrder: "asc" },
  });

  await db.$transaction([
    // Move the user entry to the new primary
    db.userEntry.updateMany({
      where: { animeId: oldPrimaryId, userId },
      data: { animeId: secondaryId },
    }),
    // New primary: clear its mergedIntoId
    db.anime.update({
      where: { id: secondaryId },
      data: { mergedIntoId: null, mergeOrder: null },
    }),
    // Old primary becomes a secondary, gets mergeOrder 0
    db.anime.update({
      where: { id: oldPrimaryId },
      data: { mergedIntoId: secondaryId, mergeOrder: 0 },
    }),
    // Re-point other secondaries to the new primary, with orders 1+
    ...otherSecondaries.map((s, i) =>
      db.anime.update({
        where: { id: s.id },
        data: { mergedIntoId: secondaryId, mergeOrder: i + 1 },
      })
    ),
  ]);

  return NextResponse.json({ newPrimaryId: secondaryId });
}
