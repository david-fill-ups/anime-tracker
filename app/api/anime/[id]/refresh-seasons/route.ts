import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { refreshSeasonData } from "@/lib/tmdb";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  await requireUserId();
  const { id } = await params;
  const anime = await db.anime.findUnique({ where: { id: Number(id) } });
  if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await refreshSeasonData(Number(id));

  const updated = await db.anime.findUnique({ where: { id: Number(id) } });
  return NextResponse.json({
    totalSeasons: updated?.totalSeasons ?? null,
    episodesPerSeason: updated?.episodesPerSeason ?? null,
  });
}
