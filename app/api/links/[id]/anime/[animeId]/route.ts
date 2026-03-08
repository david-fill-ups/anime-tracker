import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { URLIdSchema, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string; animeId: string }> };

// DELETE — remove an anime from a link (keeps anime record, removes LinkedAnime)
export async function DELETE(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id, animeId } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    const animeParsed = URLIdSchema.safeParse(animeId);
    if (!idParsed.success || !animeParsed.success) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const linkId = idParsed.data;
    const animeIdNum = animeParsed.data;

    // Verify caller owns this link
    const link = await db.link.findFirst({
      where: { id: linkId, userId },
      include: { linkedAnime: { select: { id: true, animeId: true } } },
    });
    if (!link) return NextResponse.json({ error: "Not in your library" }, { status: 403 });

    const target = link.linkedAnime.find((la) => la.animeId === animeIdNum);
    if (!target) return NextResponse.json({ error: "Anime not in this link" }, { status: 404 });

    if (link.linkedAnime.length <= 1) {
      return NextResponse.json({ error: "Cannot remove the only anime from a link — delete the entry instead" }, { status: 400 });
    }

    // Remove the linked anime and re-index the remaining ones
    const remaining = link.linkedAnime.filter((la) => la.animeId !== animeIdNum);
    await db.$transaction([
      db.linkedAnime.delete({ where: { id: target.id } }),
      ...remaining.map((la, i) =>
        db.linkedAnime.update({ where: { id: la.id }, data: { order: i } })
      ),
    ]);

    return NextResponse.json({ ok: true });
  });
}
