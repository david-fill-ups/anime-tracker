import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "@/lib/anilist";
import { autoPopulateFranchise } from "@/lib/franchise-auto";
import { refreshSeasonData } from "@/lib/tmdb";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id } = await params;
  const anime = await db.anime.findUnique({ where: { id: Number(id) } });

  if (!anime || !anime.anilistId) {
    return NextResponse.json({ error: "Not an AniList entry" }, { status: 400 });
  }

  const data = await fetchAniListById(anime.anilistId);
  if (!data) {
    return NextResponse.json({ error: "AniList fetch failed" }, { status: 502 });
  }

  const updated = await db.anime.update({
    where: { id: Number(id) },
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

  await autoPopulateFranchise(Number(id), data, userId);
  await refreshSeasonData(Number(id));

  return NextResponse.json(updated);
}
