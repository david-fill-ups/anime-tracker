import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { URLIdSchema, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

// Adds an existing DB anime to the user's library (creates Link + LinkedAnime + UserEntry)
export async function POST(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    const anime = await db.anime.findUnique({ where: { id: animeId } });
    if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Check if already tracked (anime is in any of this user's Links)
    const existingLinked = await db.linkedAnime.findFirst({
      where: { animeId, link: { userId } },
    });
    if (existingLinked) {
      return NextResponse.json({ error: "Already in your library" }, { status: 409 });
    }

    // Find existing Link for this anime (in case UserEntry was deleted but Link remains)
    const existingLink = await db.link.findFirst({
      where: { userId, linkedAnime: { some: { animeId } } },
    });

    if (existingLink) {
      // Re-create UserEntry for existing Link
      await db.userEntry.create({
        data: { linkId: existingLink.id, userId, watchStatus: "PLAN_TO_WATCH" },
      });
    } else {
      // Create Link + LinkedAnime + UserEntry
      await db.link.create({
        data: {
          userId,
          linkedAnime: { create: { animeId, order: 0 } },
          userEntry: { create: { userId, watchStatus: "PLAN_TO_WATCH" } },
        },
      });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
