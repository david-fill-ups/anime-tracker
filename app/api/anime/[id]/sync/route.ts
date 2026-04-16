import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchAniListById, mapAniListToAnimeData } from "@/lib/anilist";
import { autoPopulateFranchise } from "@/lib/franchise-auto";
import { refreshSeasonData } from "@/lib/tmdb";
import { URLIdSchema, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const anilistOnly = new URL(req.url).searchParams.get("anilistOnly") === "true";
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    const anime = await db.anime.findUnique({ where: { id: animeId } });

    if (!anime || !anime.anilistId) {
      return NextResponse.json({ error: "Not an AniList entry" }, { status: 400 });
    }

    const data = await fetchAniListById(anime.anilistId);
    if (!data) {
      return NextResponse.json({ error: "AniList fetch failed" }, { status: 502 });
    }

    // Strip identity fields — they don't change on sync
    const { anilistId: _a, source: _s, ...syncFields } = mapAniListToAnimeData(data);

    // Preserve the highest known aired-episode count so that when nextAiringEp goes
    // null (e.g. between-episode gaps) we can still tell whether the user is caught up.
    let lastKnownAiredEp: number | undefined;
    if (syncFields.nextAiringEp != null) {
      const isPast = syncFields.nextAiringAt ? syncFields.nextAiringAt.getTime() < Date.now() : false;
      const airedNow = isPast ? syncFields.nextAiringEp : syncFields.nextAiringEp - 1;
      lastKnownAiredEp = Math.max(anime.lastKnownAiredEp ?? 0, airedNow);
    }

    const updated = await db.anime.update({
      where: { id: animeId },
      data: { ...syncFields, ...(lastKnownAiredEp !== undefined ? { lastKnownAiredEp } : {}) },
    });

    await autoPopulateFranchise(animeId, data, userId);
    if (!anilistOnly) await refreshSeasonData(animeId);

    return NextResponse.json(updated);
  });
}
