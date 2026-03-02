import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { URLIdSchema, UpdateAnimeSchema, parseBody, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    const anime = await db.anime.findUnique({
      where: { id: animeId },
      include: {
        userEntries: {
          where: { userId },
          include: { recommender: true, watchContextPerson: true },
          take: 1,
        },
        franchiseEntries: { include: { franchise: true } },
        animeStudios: { include: { studio: true } },
      },
    });
    if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { userEntries, ...rest } = anime;
    return NextResponse.json({ ...rest, userEntry: userEntries[0] ?? null });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    const parsed = parseBody(UpdateAnimeSchema, await req.json());
    if (!parsed.success) return parsed.response;

    // Split updates between Anime and UserEntry
    // TODO[TEMP]: verified — remove after data review
    const { watchStatus, currentEpisode, score, notes, watchContextPersonId, recommenderId, startedAt, completedAt, verified, ...animeFields } = parsed.data;

    const updates: Promise<unknown>[] = [];

    if (Object.keys(animeFields).length > 0) {
      updates.push(
        db.anime.update({ where: { id: animeId }, data: animeFields })
      );
    }

    const entryData: Record<string, unknown> = {};
    if (watchStatus !== undefined) entryData.watchStatus = watchStatus;
    if (currentEpisode !== undefined) entryData.currentEpisode = currentEpisode;
    if (score !== undefined) entryData.score = score;
    if (notes !== undefined) entryData.notes = notes;
    if (watchContextPersonId !== undefined) entryData.watchContextPersonId = watchContextPersonId;
    if (recommenderId !== undefined) entryData.recommenderId = recommenderId;
    if (startedAt !== undefined) entryData.startedAt = startedAt ? new Date(startedAt) : null;
    if (completedAt !== undefined) entryData.completedAt = completedAt ? new Date(completedAt) : null;
    if (verified !== undefined) entryData.verified = verified; // TODO[TEMP]: remove after data review

    // Auto-set completedAt when marking complete
    if (watchStatus === "COMPLETED" && completedAt === undefined) {
      entryData.completedAt = new Date();
    }
    // Auto-set startedAt when starting to watch
    if (watchStatus === "WATCHING" && startedAt === undefined) {
      const existing = await db.userEntry.findFirst({ where: { animeId, userId } });
      if (!existing?.startedAt) entryData.startedAt = new Date();
    }

    if (Object.keys(entryData).length > 0) {
      updates.push(
        db.userEntry.update({
          where: { animeId_userId: { animeId, userId } },
          data: entryData,
        })
      );
    }

    await Promise.all(updates);

    const anime = await db.anime.findUnique({
      where: { id: animeId },
      include: {
        userEntries: {
          where: { userId },
          include: { recommender: true, watchContextPerson: true },
          take: 1,
        },
        franchiseEntries: { include: { franchise: true } },
        animeStudios: { include: { studio: true } },
      },
    });
    if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { userEntries, ...rest } = anime;
    return NextResponse.json({ ...rest, userEntry: userEntries[0] ?? null });
  });
}

// Removes this anime from the user's library (deletes UserEntry only, not global Anime)
export async function DELETE(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    try {
      await db.userEntry.delete({ where: { animeId_userId: { animeId, userId } } });
    } catch {
      // Entry may not exist
    }
    return NextResponse.json({ ok: true });
  });
}
