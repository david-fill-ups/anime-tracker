import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "@/lib/anilist";
import { refreshStreamingForAnime } from "@/lib/tmdb";

// Per-user lock: tracks user IDs that currently have a sync job running.
const activeRefreshes = new Set<string>();

// Syncs global Anime metadata from AniList and refreshes streaming links.
// Only processes anime in the current user's library.
export async function POST() {
  const userId = await requireUserId();

  if (activeRefreshes.has(userId)) {
    return NextResponse.json(
      { error: "A refresh is already in progress." },
      { status: 409 }
    );
  }

  activeRefreshes.add(userId);

  const userEntries = await db.userEntry.findMany({
    where: { userId },
    select: { anime: { select: { id: true, anilistId: true, source: true } } },
  });

  const primaryAnime = userEntries.map((e) => e.anime);

  // Also sync merged seasons (they have no UserEntry but are linked to primaries)
  const mergedExtras = await db.anime.findMany({
    where: {
      mergedIntoId: { in: primaryAnime.map((a) => a.id) },
      source: "ANILIST",
      anilistId: { not: null },
    },
    select: { id: true, anilistId: true, source: true },
  });

  const allAnime = [...primaryAnime, ...mergedExtras];

  let synced = 0;
  let errors = 0;

  try {
    for (const anime of allAnime) {
      try {
        // AniList metadata (AniList entries only)
        if (anime.source === "ANILIST" && anime.anilistId) {
          const data = await fetchAniListById(anime.anilistId);
          if (!data) {
            errors++;
            continue;
          }

          await db.anime.update({
            where: { id: anime.id },
            data: {
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
            },
          });
        }

        // Streaming / where-to-watch refresh for all anime
        await refreshStreamingForAnime(anime.id);

        synced++;
      } catch {
        errors++;
      }
    }
  } finally {
    activeRefreshes.delete(userId);
  }

  return NextResponse.json({ synced, errors, total: allAnime.length });
}
