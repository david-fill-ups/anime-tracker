import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

type Params = { params: Promise<{ id: string; secondaryId: string }> };

// DELETE — unmerge a season from this primary
export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id, secondaryId } = await params;
  const primaryId = Number(id);
  const secId = Number(secondaryId);

  // Verify caller has the primary in their library
  const primaryEntry = await db.userEntry.findFirst({ where: { animeId: primaryId, userId } });
  if (!primaryEntry) {
    return NextResponse.json({ error: "Not in your library" }, { status: 403 });
  }

  const secondary = await db.anime.findUnique({ where: { id: secId } });
  if (!secondary || secondary.mergedIntoId !== primaryId) {
    return NextResponse.json({ error: "Not merged into this anime" }, { status: 404 });
  }

  await db.anime.update({
    where: { id: secId },
    data: { mergedIntoId: null },
  });

  return NextResponse.json({ ok: true });
}
