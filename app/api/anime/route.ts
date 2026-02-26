import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "@/lib/anilist";
import type { WatchStatus, WatchContext, AnimeSource, DisplayFormat, SourceMaterial, Season } from "@/app/generated/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.source === "ANILIST" && body.anilistId) {
    // Auto-populate from AniList
    const data = await fetchAniListById(body.anilistId);
    if (!data) {
      return NextResponse.json({ error: "AniList entry not found" }, { status: 404 });
    }

    const anime = await db.anime.create({
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
        // Create studios
        animeStudios: {
          create: await upsertStudios(data.studios.edges),
        },
      },
    });

    // Create user entry
    await db.userEntry.create({
      data: {
        animeId: anime.id,
        watchStatus: (body.watchStatus as WatchStatus) ?? "PLAN_TO_WATCH",
        watchContext: (body.watchContext as WatchContext) ?? null,
        watchPartyWith: body.watchPartyWith ?? null,
        recommenderId: body.recommenderId ?? null,
      },
    });

    return NextResponse.json(anime, { status: 201 });
  }

  // Manual entry
  const anime = await db.anime.create({
    data: {
      source: "MANUAL" as AnimeSource,
      titleRomaji: body.titleRomaji,
      titleEnglish: body.titleEnglish ?? null,
      titleNative: body.titleNative ?? null,
      coverImageUrl: body.coverImageUrl ?? null,
      synopsis: body.synopsis ?? null,
      genres: JSON.stringify(body.genres ?? []),
      totalEpisodes: body.totalEpisodes ?? null,
      durationMins: body.durationMins ?? null,
      airingStatus: (body.airingStatus as AiringStatus) ?? "FINISHED",
      displayFormat: (body.displayFormat as DisplayFormat) ?? "SERIES",
      sourceMaterial: (body.sourceMaterial as SourceMaterial) ?? null,
      season: (body.season as Season) ?? null,
      seasonYear: body.seasonYear ?? null,
    },
  });

  await db.userEntry.create({
    data: {
      animeId: anime.id,
      watchStatus: (body.watchStatus as WatchStatus) ?? "PLAN_TO_WATCH",
      watchContext: (body.watchContext as WatchContext) ?? null,
      watchPartyWith: body.watchPartyWith ?? null,
      recommenderId: body.recommenderId ?? null,
    },
  });

  return NextResponse.json(anime, { status: 201 });
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

// Fix missing import
type AiringStatus = "FINISHED" | "RELEASING" | "HIATUS" | "CANCELLED" | "NOT_YET_RELEASED";
