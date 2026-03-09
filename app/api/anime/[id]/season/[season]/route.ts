import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchSeasonEpisodes, findTmdbEntry } from "@/lib/tmdb";
import { URLIdSchema, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string; season: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    await requireUserId();
    const { id, season } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    const seasonParsed = URLIdSchema.safeParse(season);
    if (!idParsed.success || !seasonParsed.success) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    const anime = await db.anime.findUnique({
      where: { id: idParsed.data },
      select: { tmdbId: true, titleEnglish: true, titleRomaji: true },
    });
    if (!anime?.tmdbId) {
      return NextResponse.json({ episodes: [] });
    }

    console.log(`[season-route] anime=${idParsed.data} tmdbId=${anime.tmdbId} season=${seasonParsed.data} title="${anime.titleEnglish ?? anime.titleRomaji}"`);
    let episodes = await fetchSeasonEpisodes(anime.tmdbId, seasonParsed.data, idParsed.data);
    console.log(`[season-route] primary fetch returned ${episodes.length} episodes`);

    // If the stored tmdbId is a season-specific entry (only has one season), season N > 1
    // will return empty. Fall back to a title search without year filter to find the
    // series-level TMDB entry, which has all seasons.
    if (episodes.length === 0 && seasonParsed.data > 1) {
      const title = anime.titleEnglish ?? anime.titleRomaji;
      if (title) {
        const match = await findTmdbEntry(title, "tv", null);
        console.log(`[season-route] fallback search for "${title}" → tmdbId=${match?.tmdbId ?? "null"} (stored=${anime.tmdbId})`);
        if (match && match.tmdbId !== anime.tmdbId) {
          episodes = await fetchSeasonEpisodes(match.tmdbId, seasonParsed.data);
          console.log(`[season-route] fallback fetch (season ${seasonParsed.data}) returned ${episodes.length} episodes`);
          // Standalone TMDB season entries list episodes under season 1, not season N
          if (episodes.length === 0 && seasonParsed.data > 1) {
            episodes = await fetchSeasonEpisodes(match.tmdbId, 1);
            console.log(`[season-route] fallback fetch (season 1) returned ${episodes.length} episodes`);
          }
        }
      }
    }

    return NextResponse.json({ episodes });
  });
}
