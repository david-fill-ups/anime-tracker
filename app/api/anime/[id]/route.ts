import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { WatchStatus, WatchContext } from "@/app/generated/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const anime = await db.anime.findUnique({
    where: { id: Number(id) },
    include: {
      userEntry: { include: { recommender: true } },
      franchiseEntries: { include: { franchise: true } },
      animeStudios: { include: { studio: true } },
    },
  });
  if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(anime);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  // Split updates between Anime and UserEntry
  const { watchStatus, score, notes, watchContext, watchPartyWith, recommenderId, startedAt, completedAt, ...animeFields } = body;

  const updates: Promise<unknown>[] = [];

  if (Object.keys(animeFields).length > 0) {
    updates.push(
      db.anime.update({ where: { id: Number(id) }, data: animeFields })
    );
  }

  const entryData: Record<string, unknown> = {};
  if (watchStatus !== undefined) entryData.watchStatus = watchStatus as WatchStatus;
  if (score !== undefined) entryData.score = score;
  if (notes !== undefined) entryData.notes = notes;
  if (watchContext !== undefined) entryData.watchContext = watchContext as WatchContext;
  if (watchPartyWith !== undefined) entryData.watchPartyWith = watchPartyWith;
  if (recommenderId !== undefined) entryData.recommenderId = recommenderId;
  if (startedAt !== undefined) entryData.startedAt = startedAt ? new Date(startedAt) : null;
  if (completedAt !== undefined) entryData.completedAt = completedAt ? new Date(completedAt) : null;

  // Auto-set completedAt when marking complete
  if (watchStatus === "COMPLETED" && completedAt === undefined) {
    entryData.completedAt = new Date();
  }
  // Auto-set startedAt when starting to watch
  if (watchStatus === "WATCHING" && startedAt === undefined) {
    const existing = await db.userEntry.findUnique({ where: { animeId: Number(id) } });
    if (!existing?.startedAt) entryData.startedAt = new Date();
  }

  if (Object.keys(entryData).length > 0) {
    updates.push(
      db.userEntry.update({ where: { animeId: Number(id) }, data: entryData })
    );
  }

  await Promise.all(updates);

  const anime = await db.anime.findUnique({
    where: { id: Number(id) },
    include: { userEntry: { include: { recommender: true } }, franchiseEntries: { include: { franchise: true } }, animeStudios: { include: { studio: true } } },
  });
  return NextResponse.json(anime);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.anime.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
