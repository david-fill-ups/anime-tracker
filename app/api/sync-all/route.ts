import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "@/lib/anilist";
import { refreshStreamingForAnime } from "@/lib/tmdb";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Per-user lock: tracks user IDs that currently have a sync job running.
const activeRefreshes = new Set<string>();

// Per-user cooldown: timestamp of when the last sync *finished*.
const lastRefreshFinished = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const ITER_DELAY_MS = 250; // pause between each anime to avoid rate-limit bursts

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

  const lastFinished = lastRefreshFinished.get(userId);
  if (lastFinished) {
    const elapsed = Date.now() - lastFinished;
    if (elapsed < COOLDOWN_MS) {
      const secsLeft = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: `Refresh on cooldown — try again in ${secsLeft}s.` },
        { status: 429 }
      );
    }
  }

  activeRefreshes.add(userId);

  // Find all anime in user's library (primary + linked) via Link records
  const linkedAnimeRecords = await db.linkedAnime.findMany({
    where: { link: { userId } },
    select: { anime: { select: { id: true, anilistId: true, source: true } } },
  });

  // Deduplicate in case same anime appears in multiple links
  const seen = new Set<number>();
  const allAnime = linkedAnimeRecords
    .map((la) => la.anime)
    .filter((a) => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });

  let synced = 0;
  let errors = 0;

  try {
    for (let i = 0; i < allAnime.length; i++) {
      if (i > 0) await sleep(ITER_DELAY_MS);
      const anime = allAnime[i];
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
    lastRefreshFinished.set(userId, Date.now());
  }

  return NextResponse.json({ synced, errors, total: allAnime.length });
}
