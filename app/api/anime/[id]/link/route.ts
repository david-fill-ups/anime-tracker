import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "@/lib/anilist";
import { URLIdSchema, LinkAniListSchema, parseBody, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    const anime = await db.anime.update({
      where: { id: animeId },
      data: { anilistId: null, source: "MANUAL" },
    });
    return NextResponse.json(anime);
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    const parsed = parseBody(LinkAniListSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { anilistId } = parsed.data;

    // Check if this anilistId is already linked to a different entry
    const conflict = await db.anime.findUnique({
      where: { anilistId },
      include: { linkedIn: { select: { id: true }, take: 1 } },
    });
    if (conflict && conflict.id !== animeId) {
      if (conflict.linkedIn.length > 0) {
        return NextResponse.json(
          { error: "This AniList ID is already linked to another entry in your library" },
          { status: 409 }
        );
      }
      // Orphaned Anime record (no user entries) — clear its anilistId so we can claim it
      await db.anime.update({ where: { id: conflict.id }, data: { anilistId: null, source: "MANUAL" } });
    }

    // Save the link first
    await db.anime.update({
      where: { id: animeId },
      data: { anilistId, source: "ANILIST" },
    });

    // Immediately sync metadata from AniList
    const data = await fetchAniListById(anilistId);
    if (data) {
      const anime = await db.anime.update({
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
      return NextResponse.json(anime);
    }

    const anime = await db.anime.findUnique({ where: { id: animeId } });
    return NextResponse.json(anime);
  });
}
