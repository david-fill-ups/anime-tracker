import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchSeasonEpisodes } from "@/lib/tmdb";
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
      select: { tmdbId: true },
    });
    if (!anime?.tmdbId) {
      return NextResponse.json({ episodes: [] });
    }

    const episodes = await fetchSeasonEpisodes(anime.tmdbId, seasonParsed.data);
    return NextResponse.json({ episodes });
  });
}
