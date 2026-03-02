import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { URLIdSchema, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string; secondaryId: string }> };

// DELETE — unmerge a season from this primary
export async function DELETE(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id, secondaryId } = await params;
    const primaryParsed = URLIdSchema.safeParse(id);
    const secParsed = URLIdSchema.safeParse(secondaryId);
    if (!primaryParsed.success || !secParsed.success) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const primaryId = primaryParsed.data;
    const secId = secParsed.data;

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
  });
}
