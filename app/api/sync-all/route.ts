import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchAniListById, mapAniListToAnimeData } from "@/lib/anilist";
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
    select: { anime: { select: { id: true, anilistId: true, source: true, titleRomaji: true, titleEnglish: true } } },
  });

  // Deduplicate in case same anime appears in multiple links
  const seen = new Set<number>();
  const allAnime = linkedAnimeRecords
    .map((la) => la.anime)
    .filter((a) => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });

  let synced = 0;
  let errors = 0;
  const failed: { id: number; title: string; reason: string }[] = [];

  try {
    for (let i = 0; i < allAnime.length; i++) {
      if (i > 0) await sleep(ITER_DELAY_MS);
      const anime = allAnime[i];
      const title = anime.titleEnglish ?? anime.titleRomaji;
      try {
        // AniList metadata (AniList entries only)
        if (anime.source === "ANILIST" && anime.anilistId) {
          const data = await fetchAniListById(anime.anilistId);
          if (!data) {
            errors++;
            failed.push({ id: anime.id, title, reason: "AniList fetch returned null" });
            continue;
          }

          const { anilistId: _a, source: _s, ...syncFields } = mapAniListToAnimeData(data);
          await db.anime.update({ where: { id: anime.id }, data: syncFields });
        }

        // Streaming / where-to-watch refresh for all anime
        await refreshStreamingForAnime(anime.id);

        synced++;
      } catch (err) {
        errors++;
        failed.push({ id: anime.id, title, reason: err instanceof Error ? err.message : "Unknown error" });
      }
    }
  } finally {
    activeRefreshes.delete(userId);
    lastRefreshFinished.set(userId, Date.now());
  }

  return NextResponse.json({ synced, errors, total: allAnime.length, failed });
}
