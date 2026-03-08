import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "@/lib/anilist";
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

    const updated = await db.anime.update({
      where: { id: animeId },
      data: {
        titleRomaji: data.title.romaji,
        titleEnglish: data.title.english ?? null,
        titleNative: data.title.native ?? null,
        coverImageUrl: data.coverImage.large,
        synopsis: data.description ?? null,
        genres: JSON.stringify(data.genres),
        totalEpisodes: data.episodes ?? null,
        durationMins: data.duration ?? null,
        airingStatus: data.status,
        displayFormat: mapDisplayFormat(data.format),
        sourceMaterial: mapSourceMaterial(data.source),
        season: data.season ?? null,
        seasonYear: data.seasonYear ?? null,
        meanScore: data.meanScore ?? null,
        nextAiringEp: data.nextAiringEpisode?.episode ?? null,
        nextAiringAt: data.nextAiringEpisode
          ? new Date(data.nextAiringEpisode.airingAt * 1000)
          : null,
        lastSyncedAt: new Date(),
      },
    });

    await autoPopulateFranchise(animeId, data, userId);
    if (!anilistOnly) await refreshSeasonData(animeId);

    return NextResponse.json(updated);
  });
}
