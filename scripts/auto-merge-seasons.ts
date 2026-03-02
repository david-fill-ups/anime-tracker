/**
 * auto-merge-seasons.ts
 *
 * For every primary anime in the library that has an AniList ID:
 *   1. Walk its full SEQUEL chain on AniList (TV / TV_SHORT format only)
 *   2. Merge each season that isn't already a separately-tracked primary
 *
 * Skips (and reports) sequels already tracked as their own primary with a user entry
 * so no progress/notes data is silently destroyed.
 *
 * Usage: npx tsx scripts/auto-merge-seasons.ts [--dry-run]
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "../lib/anilist";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as any);

const DRY_RUN = process.argv.includes("--dry-run");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── AniList helpers ──────────────────────────────────────────────────────────

const FORMATS_TO_MERGE = new Set(["TV", "TV_SHORT"]);

/**
 * Fetch AniList data with a delay to respect rate limits (~85 req/min).
 * Retries once after 3s on failure before giving up.
 */
async function fetchWithDelay(id: number) {
  await sleep(1000);
  const result = await fetchAniListById(id);
  if (result) return result;
  // Retry after longer wait (rate limit recovery)
  console.log(`  ⟳ Retrying AniList id=${id} after 15s...`);
  await sleep(15000);
  return fetchAniListById(id);
}

/**
 * Walk the SEQUEL chain starting from `startAnilistId`.
 * Returns an ordered array of AniList IDs for each TV/TV_SHORT season found
 * (not including the start ID itself).
 */
async function getSequelChain(startAnilistId: number): Promise<number[]> {
  const chain: number[] = [];
  const visited = new Set<number>([startAnilistId]);

  // Fetch the start entry first
  let currentData = await fetchWithDelay(startAnilistId);
  if (!currentData) return chain;

  while (true) {
    // Find the first direct ANIME SEQUEL
    const sequelEdge = currentData.relations.edges.find(
      (e) => e.relationType === "SEQUEL" && e.node.type === "ANIME"
    );
    if (!sequelEdge) break;

    const nextId = sequelEdge.node.id;
    if (visited.has(nextId)) break; // cycle guard
    visited.add(nextId);

    // Fetch the sequel (reuse this data in the next loop iteration — no double fetch)
    const nextData = await fetchWithDelay(nextId);
    if (!nextData) break;

    if (!FORMATS_TO_MERGE.has(nextData.format)) {
      // e.g. a movie sequel — stop the chain
      console.log(`  ↳ SEQUEL id=${nextId} "${nextData.title.english ?? nextData.title.romaji}" is format=${nextData.format}, stopping chain.`);
      break;
    }

    chain.push(nextId);
    currentData = nextData; // reuse in next iteration — avoids double-fetch
  }

  return chain;
}

// ── Merge helpers ────────────────────────────────────────────────────────────

async function upsertAnimeFromAniList(anilistId: number): Promise<{ id: number; titleEnglish: string | null; titleRomaji: string } | null> {
  const existing = await db.anime.findUnique({ where: { anilistId } });
  if (existing) return existing;

  const data = await fetchWithDelay(anilistId);
  if (!data) return null;

  const record = await db.anime.create({
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
  return record;
}

async function mergeInto(secondaryId: number, primaryId: number) {
  // Remove any user entry pointing to the secondary (from any user)
  await db.userEntry.deleteMany({ where: { animeId: secondaryId } });
  await db.anime.update({
    where: { id: secondaryId },
    data: { mergedIntoId: primaryId },
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log("DRY RUN — no DB changes will be made.\n");

  // All primary anime in the library that have an AniList ID
  const primaries = await db.anime.findMany({
    where: { mergedIntoId: null, source: "ANILIST", anilistId: { not: null } },
    include: {
      userEntries: { take: 1 },
      mergedAnimes: { select: { anilistId: true } },
    },
    orderBy: { titleRomaji: "asc" },
  });

  console.log(`Checking ${primaries.length} primary anime...\n`);

  const skipped: string[] = [];
  let mergedCount = 0;

  for (const primary of primaries) {
    const primaryAnilistId = primary.anilistId!;
    const title = primary.titleEnglish ?? primary.titleRomaji;

    // Already-merged anilist IDs for this primary
    const alreadyMergedIds = new Set(
      primary.mergedAnimes.map((m) => m.anilistId).filter(Boolean) as number[]
    );

    // Walk the sequel chain
    const chain = await getSequelChain(primaryAnilistId);
    if (chain.length === 0) continue;

    console.log(`\n${title} (anilist=${primaryAnilistId})`);
    console.log(`  Sequel chain: [${chain.join(", ")}]`);

    for (const sequelAnilistId of chain) {
      if (alreadyMergedIds.has(sequelAnilistId)) {
        console.log(`  ✓ id=${sequelAnilistId} already merged, skipping.`);
        continue;
      }

      // Check if this sequel is already a separate primary with its own user entry
      const existing = await db.anime.findUnique({ where: { anilistId: sequelAnilistId } });

      if (existing) {
        if (existing.mergedIntoId !== null && existing.mergedIntoId !== primary.id) {
          console.log(`  ⚠ id=${sequelAnilistId} "${existing.titleEnglish ?? existing.titleRomaji}" already merged into a different primary (db#${existing.mergedIntoId}), skipping.`);
          skipped.push(`${title}: sequel id=${sequelAnilistId} already merged elsewhere`);
          continue;
        }

        if (existing.mergedIntoId === primary.id) {
          console.log(`  ✓ id=${sequelAnilistId} already merged into this primary, skipping.`);
          continue;
        }

        const existingEntry = await db.userEntry.findFirst({ where: { animeId: existing.id } });
        if (existingEntry) {
          const episodeNote = existingEntry.currentEpisode
            ? ` (ep ${existingEntry.currentEpisode}, status=${existingEntry.watchStatus})`
            : ` (status=${existingEntry.watchStatus})`;
          console.log(`  ⚠ id=${sequelAnilistId} "${existing.titleEnglish ?? existing.titleRomaji}" is a separately-tracked primary${episodeNote} — skipping to preserve data.`);
          skipped.push(`${title}: sequel "${existing.titleEnglish ?? existing.titleRomaji}" (db#${existing.id}) tracked separately${episodeNote}`);
          continue;
        }
      }

      // Safe to merge
      if (DRY_RUN) {
        const label = existing
          ? `"${existing.titleEnglish ?? existing.titleRomaji}" (db#${existing.id})`
          : `anilist=${sequelAnilistId} (would create)`;
        console.log(`  → [DRY] Would merge ${label} into ${title}`);
      } else {
        const secondary = await upsertAnimeFromAniList(sequelAnilistId);
        if (!secondary) {
          console.log(`  ⚠ id=${sequelAnilistId} — AniList fetch failed, skipping.`);
          skipped.push(`${title}: sequel id=${sequelAnilistId} could not be fetched from AniList`);
          continue;
        }
        await mergeInto(secondary.id, primary.id);
        console.log(`  ✅ Merged "${secondary.titleEnglish ?? secondary.titleRomaji}" (db#${secondary.id}) into ${title}`);
        mergedCount++;
      }
    }
  }

  console.log("\n──────────────────────────────────────────");
  if (DRY_RUN) {
    console.log("Dry run complete. Re-run without --dry-run to apply.");
  } else {
    console.log(`Done. ${mergedCount} season(s) merged.`);
  }

  if (skipped.length > 0) {
    console.log(`\n${skipped.length} item(s) skipped (review manually):`);
    for (const s of skipped) console.log(`  • ${s}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
