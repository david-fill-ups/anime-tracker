import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "@/lib/anilist";
import { MERGED_ANIME_SELECT } from "@/lib/anime-utils";

type Params = { params: Promise<{ id: string }> };

// GET — list merged seasons for this primary
export async function GET(_req: NextRequest, { params }: Params) {
  await requireUserId();
  const { id } = await params;
  const merged = await db.anime.findMany({
    where: { mergedIntoId: Number(id) },
    select: MERGED_ANIME_SELECT,
    orderBy: { mergeOrder: "asc" },
  });
  return NextResponse.json(merged);
}

// PATCH { orderedIds: number[] } — reorder merged seasons
export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id } = await params;
  const primaryId = Number(id);
  const { orderedIds } = await req.json() as { orderedIds: number[] };

  if (!Array.isArray(orderedIds) || orderedIds.some((x) => typeof x !== "number")) {
    return NextResponse.json({ error: "orderedIds must be number[]" }, { status: 400 });
  }

  const primaryEntry = await db.userEntry.findFirst({ where: { animeId: primaryId, userId } });
  if (!primaryEntry) {
    return NextResponse.json({ error: "Not in your library" }, { status: 403 });
  }

  await db.$transaction(
    orderedIds.map((secId, i) =>
      db.anime.updateMany({
        where: { id: secId, mergedIntoId: primaryId },
        data: { mergeOrder: i },
      })
    )
  );

  return NextResponse.json({ ok: true });
}

// POST { anilistId } or { animeId } — merge a season into this primary
export async function POST(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id } = await params;
  const primaryId = Number(id);
  const { anilistId, animeId } = await req.json();

  if ((!anilistId || typeof anilistId !== "number") && (!animeId || typeof animeId !== "number")) {
    return NextResponse.json({ error: "anilistId or animeId required" }, { status: 400 });
  }

  // Verify caller has the primary in their library
  const primaryEntry = await db.userEntry.findFirst({ where: { animeId: primaryId, userId } });
  if (!primaryEntry) {
    return NextResponse.json({ error: "Not in your library" }, { status: 403 });
  }

  // Find or create the secondary Anime
  let secondary = animeId
    ? await db.anime.findUnique({ where: { id: animeId } })
    : await db.anime.findUnique({ where: { anilistId } });

  if (!secondary && animeId) {
    return NextResponse.json({ error: `Anime not found` }, { status: 404 });
  }

  if (!secondary) {
    const data = await fetchAniListById(anilistId);
    if (!data) {
      return NextResponse.json({ error: `No AniList entry found for id ${anilistId}` }, { status: 404 });
    }
    secondary = await db.anime.create({
      data: {
        anilistId: data.id,
        source: "ANILIST",
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
        lastSyncedAt: new Date(),
      },
    });
  }

  if (secondary.id === primaryId) {
    return NextResponse.json({ error: "Cannot merge an anime into itself" }, { status: 400 });
  }

  if (secondary.mergedIntoId && secondary.mergedIntoId !== primaryId) {
    return NextResponse.json({ error: "This season is already merged into another anime" }, { status: 409 });
  }

  // Assign mergeOrder = current count of merged seasons
  const existingCount = await db.anime.count({ where: { mergedIntoId: primaryId } });

  // If secondary already has a UserEntry for this user, remove it, then set the merge link
  await db.$transaction([
    db.userEntry.deleteMany({ where: { animeId: secondary.id, userId } }),
    db.anime.update({
      where: { id: secondary.id },
      data: { mergedIntoId: primaryId, mergeOrder: existingCount },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
