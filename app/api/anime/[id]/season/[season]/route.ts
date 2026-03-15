import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchSeasonEpisodes, findTmdbEntry, fetchEpisodesAtOffset } from "@/lib/tmdb";
import { URLIdSchema, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string; season: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    await requireUserId();
    const { id, season } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    const seasonParsed = URLIdSchema.safeParse(season);
    if (!idParsed.success || !seasonParsed.success) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    const episodeOffset = Number(req.nextUrl.searchParams.get("episodeOffset") ?? "-1");
    const episodeCount = Number(req.nextUrl.searchParams.get("episodeCount") ?? "0");
    const hasOffsetParams = episodeOffset >= 0 && episodeCount > 0;

    const anime = await db.anime.findUnique({
      where: { id: idParsed.data },
      select: { tmdbId: true, titleEnglish: true, titleRomaji: true },
    });
    if (!anime?.tmdbId) {
      return NextResponse.json({ episodes: [] });
    }

    let episodes: Array<{ number: number; name: string }> = [];

    if (hasOffsetParams) {
      // Multi-link mode: virtual season number ≠ TMDB season number, so skip the direct
      // season-number fetch (it would return wrong episodes) and go straight to offset walk.
      episodes = await fetchEpisodesAtOffset(anime.tmdbId, episodeOffset, episodeCount);
    } else {
      // Standalone / single-season mode: use the season number directly.
      episodes = await fetchSeasonEpisodes(anime.tmdbId, seasonParsed.data, idParsed.data);

      // If direct fetch failed, try title search for a series-level TMDB entry
      if (episodes.length === 0 && seasonParsed.data > 1) {
        const title = anime.titleEnglish ?? anime.titleRomaji;
        if (title) {
          const match = await findTmdbEntry(title, "tv", null);
          if (match && match.tmdbId !== anime.tmdbId) {
            episodes = await fetchSeasonEpisodes(match.tmdbId, seasonParsed.data);
            if (episodes.length === 0 && seasonParsed.data > 1) {
              episodes = await fetchSeasonEpisodes(match.tmdbId, 1);
            }
          }
        }
      }
    }

    return NextResponse.json({ episodes });
  });
}
