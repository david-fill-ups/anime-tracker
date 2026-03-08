import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { URLIdSchema, UpdateAnimeSchema, parseBody, wrapHandler } from "@/lib/validation";
import { LINKED_ANIME_SELECT } from "@/lib/anime-utils";

type Params = { params: Promise<{ id: string }> };

// Resolves the user's Link and UserEntry for a given animeId
async function getLinkAndEntry(animeId: number, userId: string) {
  const link = await db.link.findFirst({
    where: { userId, linkedAnime: { some: { animeId } } },
    include: {
      linkedAnime: {
        include: { anime: { select: LINKED_ANIME_SELECT } },
        orderBy: { order: "asc" },
      },
      userEntry: { include: { recommender: true, watchContextPerson: true } },
    },
  });
  return link;
}

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
        franchiseEntries: { include: { franchise: true } },
        animeStudios: { include: { studio: true } },
      },
    });
    if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const link = await getLinkAndEntry(animeId, userId);
    return NextResponse.json({ ...anime, link, userEntry: link?.userEntry ?? null });
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
    const { watchStatus, currentEpisode, score, notes, watchContextPersonId, recommenderId, discoveryType, discoverySource, startedAt, completedAt, verified, ...animeFields } = parsed.data;

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
    if (discoveryType !== undefined) entryData.discoveryType = discoveryType;
    if (discoverySource !== undefined) entryData.discoverySource = discoverySource;
    if (startedAt !== undefined) entryData.startedAt = startedAt ? new Date(startedAt) : null;
    if (completedAt !== undefined) entryData.completedAt = completedAt ? new Date(completedAt) : null;
    if (verified !== undefined) entryData.verified = verified; // TODO[TEMP]: remove after data review

    // Auto-set completedAt when marking complete
    if (watchStatus === "COMPLETED" && completedAt === undefined) {
      entryData.completedAt = new Date();
    }

    if (Object.keys(entryData).length > 0) {
      // Auto-set startedAt when starting to watch
      if (watchStatus === "WATCHING" && startedAt === undefined) {
        const link = await db.link.findFirst({
          where: { userId, linkedAnime: { some: { animeId } } },
          select: { userEntry: { select: { startedAt: true, linkId: true } } },
        });
        if (!link?.userEntry?.startedAt) entryData.startedAt = new Date();
      }

      const link = await db.link.findFirst({
        where: { userId, linkedAnime: { some: { animeId } } },
        select: { id: true },
      });
      if (link) {
        updates.push(
          db.userEntry.update({ where: { linkId: link.id }, data: entryData })
        );
      }
    }

    await Promise.all(updates);

    const anime = await db.anime.findUnique({
      where: { id: animeId },
      include: {
        franchiseEntries: { include: { franchise: true } },
        animeStudios: { include: { studio: true } },
      },
    });
    if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const link = await getLinkAndEntry(animeId, userId);
    return NextResponse.json({ ...anime, link, userEntry: link?.userEntry ?? null });
  });
}

// Removes this anime from the user's library (deletes UserEntry + Link if empty)
export async function DELETE(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    const link = await db.link.findFirst({
      where: { userId, linkedAnime: { some: { animeId } } },
      select: { id: true },
    });

    if (link) {
      try {
        // Delete the UserEntry — Link + LinkedAnime records persist (structure preserved for re-add)
        await db.userEntry.delete({ where: { linkId: link.id } });
      } catch {
        // Entry may not exist
      }
    }
    return NextResponse.json({ ok: true });
  });
}
