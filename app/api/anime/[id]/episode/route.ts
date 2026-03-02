import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { effectiveTotalEpisodes } from "@/lib/anime-utils";
import { URLIdSchema, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    const entry = await db.userEntry.findFirst({ where: { animeId, userId } });
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const anime = await db.anime.findUnique({
      where: { id: animeId },
      include: { mergedAnimes: { select: { totalEpisodes: true } } },
    });
    const newEpisode = entry.currentEpisode + 1;

    const data: Record<string, unknown> = { currentEpisode: newEpisode };

    // Auto-complete when last episode reached (uses effective total across all merged seasons)
    const totalEps = anime ? effectiveTotalEpisodes(anime) : null;
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
      where: { animeId_userId: { animeId, userId } },
      data,
    });
    return NextResponse.json(updated);
  });
}
