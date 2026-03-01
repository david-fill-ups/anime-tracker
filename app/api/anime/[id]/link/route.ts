import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "@/lib/anilist";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  await requireUserId();
  const { id } = await params;
  const { anilistId } = await req.json();

  if (!anilistId || typeof anilistId !== "number") {
    return NextResponse.json({ error: "anilistId is required and must be a number" }, { status: 400 });
  }

  // Check if this anilistId is already linked to a different entry
  const conflict = await db.anime.findUnique({ where: { anilistId } });
  if (conflict && conflict.id !== Number(id)) {
    return NextResponse.json(
      { error: "This AniList ID is already linked to another entry in your library" },
      { status: 409 }
    );
  }

  // Save the link first
  await db.anime.update({
    where: { id: Number(id) },
    data: { anilistId, source: "ANILIST" },
  });

  // Immediately sync metadata from AniList
  const data = await fetchAniListById(anilistId);
  if (data) {
    const anime = await db.anime.update({
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
    return NextResponse.json(anime);
  }

  const anime = await db.anime.findUnique({ where: { id: Number(id) } });
  return NextResponse.json(anime);
}
