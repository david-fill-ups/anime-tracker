import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "@/lib/anilist";
import { URLIdSchema, wrapHandler } from "@/lib/validation";
import { LINKED_ANIME_SELECT } from "@/lib/anime-utils";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const AddAnimeSchema = z.union([
  z.object({ animeId: z.number().int().positive() }),
  z.object({ anilistId: z.number().int().positive() }),
  z.object({ manual: z.object({ title: z.string().min(1).max(500), totalEpisodes: z.number().int().positive().optional() }) }),
]);

// POST { animeId } or { anilistId } — add an anime to this link
export async function POST(req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const linkId = idParsed.data;

    const body = AddAnimeSchema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: "animeId or anilistId required" }, { status: 400 });

    // Verify caller owns this link
    const link = await db.link.findFirst({
      where: { id: linkId, userId },
      include: {
        linkedAnime: { select: { animeId: true, order: true } },
      },
    });
    if (!link) return NextResponse.json({ error: "Not in your library" }, { status: 403 });

    // Find or create the anime
    let anime =
      "animeId" in body.data
        ? await db.anime.findUnique({ where: { id: body.data.animeId } })
        : "anilistId" in body.data
        ? await db.anime.findUnique({ where: { anilistId: body.data.anilistId } })
        : null;

    if (!anime && "animeId" in body.data) {
      return NextResponse.json({ error: "Anime not found" }, { status: 404 });
    }

    if (!anime && "anilistId" in body.data) {
      const anilistId = (body.data as { anilistId: number }).anilistId;
      const data = await fetchAniListById(anilistId);
      if (!data) {
        return NextResponse.json({ error: `No AniList entry found for id ${anilistId}` }, { status: 404 });
      }
      anime = await db.anime.create({
        data: {
          anilistId: data.id,
          source: "ANILIST",
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
          lastSyncedAt: new Date(),
        },
      });
    }

    if (!anime && "manual" in body.data) {
      const { title, totalEpisodes } = body.data.manual;
      anime = await db.anime.create({
        data: {
          source: "MANUAL",
          titleRomaji: title,
          airingStatus: "FINISHED",
          totalEpisodes: totalEpisodes ?? null,
        },
      });
    }

    if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });

    // Check not adding the same anime to the same link
    if (link.linkedAnime.some((la) => la.animeId === anime.id)) {
      return NextResponse.json({ error: "Anime is already in this link" }, { status: 409 });
    }

    // If this anime is in another link for this user, remove it from there first
    const otherLinked = await db.linkedAnime.findFirst({
      where: { animeId: anime.id, link: { userId, id: { not: linkId } } },
      include: { link: { include: { linkedAnime: true, userEntry: true } } },
    });
    if (otherLinked) {
      await db.$transaction(async (tx) => {
        // Remove from other link
        await tx.linkedAnime.delete({ where: { id: otherLinked.id } });
        // If other link is now empty, delete it (and its UserEntry via cascade)
        if (otherLinked.link.linkedAnime.length <= 1) {
          await tx.link.delete({ where: { id: otherLinked.linkId } });
        }
      });
    }

    // Assign order = current count
    const nextOrder = link.linkedAnime.length;

    // Fetch userEntry before creating LinkedAnime so we can check current status
    const userEntry = await db.userEntry.findUnique({ where: { linkId } });

    await db.linkedAnime.create({ data: { linkId, animeId: anime.id, order: nextOrder } });

    // If the link was COMPLETED, adding a new season means they're now Watching again.
    // currentEpisode is cumulative, so it's already positioned at the start of the new entry.
    if (userEntry?.watchStatus === "COMPLETED") {
      await db.userEntry.update({
        where: { linkId },
        data: { watchStatus: "WATCHING", completedAt: null },
      });
    }

    const updated = await db.link.findUnique({
      where: { id: linkId },
      include: {
        linkedAnime: {
          include: { anime: { select: LINKED_ANIME_SELECT } },
          orderBy: { order: "asc" },
        },
        userEntry: { include: { recommender: true, watchContextPerson: true } },
      },
    });
    return NextResponse.json(updated);
  });
}
