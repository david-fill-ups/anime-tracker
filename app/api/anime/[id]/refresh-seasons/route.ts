import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { refreshSeasonData } from "@/lib/tmdb";
import { URLIdSchema, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    const anime = await db.anime.findUnique({ where: { id: animeId } });
    if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await refreshSeasonData(animeId);

    const updated = await db.anime.findUnique({ where: { id: animeId } });
    return NextResponse.json({
      totalSeasons: updated?.totalSeasons ?? null,
      episodesPerSeason: updated?.episodesPerSeason ?? null,
    });
  });
}
