import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { effectiveTotalEpisodesFromLink } from "@/lib/anime-utils";
import { URLIdSchema, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    // Load entry and link together
    const link = await db.link.findFirst({
      where: { userId, linkedAnime: { some: { animeId } } },
      include: {
        userEntry: true,
        linkedAnime: { include: { anime: { select: { totalEpisodes: true, airingStatus: true } } } },
      },
    });
    if (!link?.userEntry) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const entry = link.userEntry;
    const newEpisode = entry.currentEpisode + 1;
    const data: Record<string, unknown> = { currentEpisode: newEpisode };

    // Auto-complete when last episode reached (uses total across all linked anime)
    const totalEps = effectiveTotalEpisodesFromLink(link.linkedAnime);
    if (totalEps && newEpisode >= totalEps) {
      data.watchStatus = "COMPLETED";
      data.completedAt = new Date();
    }

    // Auto-start if not started
    if (!entry.startedAt) {
      data.startedAt = new Date();
      data.watchStatus = "WATCHING";
    }

    const updated = await db.userEntry.update({
      where: { linkId: link.id },
      data,
    });
    return NextResponse.json(updated);
  });
}
