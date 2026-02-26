import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const animeId = Number(id);

  const entry = await db.userEntry.findUnique({ where: { animeId } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const anime = await db.anime.findUnique({ where: { id: animeId } });
  const newEpisode = entry.currentEpisode + 1;

  const data: Record<string, unknown> = { currentEpisode: newEpisode };

  // Auto-complete when last episode reached
  if (anime?.totalEpisodes && newEpisode >= anime.totalEpisodes) {
    data.watchStatus = "COMPLETED";
    data.completedAt = new Date();
  }

  // Auto-start if not started
  if (!entry.startedAt) {
    data.startedAt = new Date();
    data.watchStatus = "WATCHING";
  }

  const updated = await db.userEntry.update({ where: { animeId }, data });
  return NextResponse.json(updated);
}
