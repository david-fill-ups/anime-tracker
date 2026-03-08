import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "@/lib/anilist";
import { refreshStreamingForAnime } from "@/lib/tmdb";
import { autoPopulateFranchise } from "@/lib/franchise-auto";
import { CreateAnimeSchema, parseBody, wrapHandler } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const parsed = parseBody(CreateAnimeSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const body = parsed.data;

  if (body.source === "ANILIST") {
    const data = await fetchAniListById(body.anilistId);
    if (!data) {
      return NextResponse.json({ error: "AniList entry not found" }, { status: 404 });
    }

    // If anime already exists in the global catalog, reuse it
    const existing = await db.anime.findUnique({ where: { anilistId: data.id } });

    const anime = existing ?? await db.anime.create({
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
        nextAiringEp: data.nextAiringEpisode?.episode ?? null,
        nextAiringAt: data.nextAiringEpisode
          ? new Date(data.nextAiringEpisode.airingAt * 1000)
          : null,
        lastSyncedAt: new Date(),
        animeStudios: {
          create: await upsertStudios(data.studios.edges),
        },
      },
    });

    // Check if user already has this anime in any link
    const existingLinked = await db.linkedAnime.findFirst({
      where: { animeId: anime.id, link: { userId } },
    });
    if (existingLinked) {
      return NextResponse.json({ error: "Already in your library" }, { status: 409 });
    }

    // Create Link + LinkedAnime + UserEntry atomically
    await db.link.create({
      data: {
        userId,
        linkedAnime: { create: { animeId: anime.id, order: 0 } },
        userEntry: {
          create: {
            userId,
            watchStatus: body.watchStatus ?? "PLAN_TO_WATCH",
            watchContextPersonId: body.watchContextPersonId ?? null,
            recommenderId: body.recommenderId ?? null,
            discoveryType: body.discoveryType ?? null,
            discoverySource: body.discoverySource ?? null,
          },
        },
      },
    });

    await refreshStreamingForAnime(anime.id);
    await autoPopulateFranchise(anime.id, data, userId);

    return NextResponse.json(anime, { status: 201 });
  }

  // Manual entry
  const anime = await db.anime.create({
    data: {
      source: "MANUAL",
      titleRomaji: body.titleRomaji,
      titleEnglish: body.titleEnglish ?? null,
      titleNative: body.titleNative ?? null,
      coverImageUrl: body.coverImageUrl ?? null,
      synopsis: body.synopsis ?? null,
      genres: JSON.stringify(body.genres ?? []),
      totalEpisodes: body.totalEpisodes ?? null,
      durationMins: body.durationMins ?? null,
      airingStatus: body.airingStatus ?? "FINISHED",
      displayFormat: body.displayFormat ?? "SERIES",
      sourceMaterial: body.sourceMaterial ?? null,
      season: body.season ?? null,
      seasonYear: body.seasonYear ?? null,
    },
  });

  await db.link.create({
    data: {
      userId,
      linkedAnime: { create: { animeId: anime.id, order: 0 } },
      userEntry: {
        create: {
          userId,
          watchStatus: body.watchStatus ?? "PLAN_TO_WATCH",
          watchContextPersonId: body.watchContextPersonId ?? null,
          recommenderId: body.recommenderId ?? null,
          discoveryType: body.discoveryType ?? null,
          discoverySource: body.discoverySource ?? null,
        },
      },
    },
  });

  await refreshStreamingForAnime(anime.id);

  return NextResponse.json(anime, { status: 201 });
  });
}

async function upsertStudios(
  edges: { isMain: boolean; node: { id: number; name: string } }[]
) {
  const creates = [];
  for (const edge of edges) {
    const studio = await db.studio.upsert({
      where: { anilistStudioId: edge.node.id },
      update: { name: edge.node.name },
      create: { name: edge.node.name, anilistStudioId: edge.node.id },
    });
    creates.push({ studioId: studio.id, isMainStudio: edge.isMain });
  }
  return creates;
}
