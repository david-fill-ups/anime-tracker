/**
 * Adds proper per-season AniList links for shows currently tracked as a single entry
 * spanning multiple TMDB seasons. Each show's SEQUEL chain is traversed on AniList,
 * and all TV-format seasons are linked together as LinkedAnime in the existing Link.
 *
 * Special handling:
 *   - KONOSUBA: DB record anilistId 21574 is the Choker OVA, not S1. Uses PARENT
 *     relation to find the real main series entry before traversing.
 *   - Seraph of the End: totalEpisodes is wrong (9 vs 12). Re-synced from AniList.
 *
 * Safe to re-run: uses upsert for LinkedAnime records.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); dotenv.config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchAniListById, mapAniListToAnimeData } from "../lib/anilist";
import type { AniListAnime } from "../lib/anilist";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as any);

// AniList IDs currently in DB that need season linking.
// Single-entry shows (HxH, Naruto, ONE PIECE, DBZ, Yu Yu Hakusho) are intentionally
// excluded — AniList treats them as one entry and TMDB seasons are just episode groupings.
const TARGETS: number[] = [
  101571, // Aggretsuko S1
  21574,  // KONOSUBA — actually the Choker OVA, see special handling below
  21483,  // Seraph of the End S1
  101280, // That Time I Got Reincarnated as a Slime S1
  114121, // The Daily Life of the Immortal King S1
  183133, // The Unaware Atelier Meister S1
  97986,  // Made in Abyss S1
];

/** Follow PREQUEL chain to find the earliest entry in a series. */
async function findEarliestInChain(id: number): Promise<number> {
  const visited = new Set<number>();
  let current = id;
  while (!visited.has(current)) {
    visited.add(current);
    const data = await fetchAniListById(current);
    if (!data) break;
    const prequel = data.relations.edges.find(
      (e) => e.relationType === "PREQUEL" && e.node.type === "ANIME"
    );
    if (!prequel) break;
    current = prequel.node.id;
  }
  return current;
}

// Formats treated as "main series" (as opposed to OVA/SPECIAL side entries)
const MAIN_FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);

/** Follow SEQUEL chain from the earliest entry, collecting only main-series-format entries. */
async function buildSeasonChain(startId: number): Promise<AniListAnime[]> {
  const chain: AniListAnime[] = [];
  const visited = new Set<number>();
  let current: number | null = startId;
  while (current !== null && !visited.has(current)) {
    visited.add(current);
    const data = await fetchAniListById(current);
    if (!data) break;
    if (MAIN_FORMATS.has(data.format)) {
      chain.push(data);
    }
    const sequel = data.relations.edges.find(
      (e) => e.relationType === "SEQUEL" && e.node.type === "ANIME"
    );
    current = sequel?.node.id ?? null;
  }
  return chain;
}

/**
 * For entries that are OVAs/specials (not main series format), find the main series
 * via the PARENT relation, then follow PREQUELs to S1.
 * Returns null if this is already a main-series entry (no special handling needed).
 */
async function resolveMainSeriesId(anilistId: number): Promise<number | null> {
  const data = await fetchAniListById(anilistId);
  if (!data) return null;
  if (MAIN_FORMATS.has(data.format)) return null; // already main series

  console.log(`  ⚠ anilistId ${anilistId} is format=${data.format} ("${data.title.english ?? data.title.romaji}")`);

  // Look for PARENT relation (OVA → main series)
  const parent = data.relations.edges.find(
    (e) => e.relationType === "PARENT" && e.node.type === "ANIME"
  );
  if (parent) {
    console.log(`  → Found PARENT relation: anilistId ${parent.node.id} ("${parent.node.title.english ?? parent.node.title.romaji}")`);
    return parent.node.id;
  }

  // Fallback: try SOURCE relation
  const source = data.relations.edges.find(
    (e) => e.relationType === "SOURCE" && e.node.type === "ANIME"
  );
  if (source) {
    console.log(`  → Found SOURCE relation: anilistId ${source.node.id}`);
    return source.node.id;
  }

  console.log(`  ✗ Could not find main series via PARENT/SOURCE for anilistId ${anilistId}`);
  return null;
}

async function main() {
  for (const targetAnilistId of TARGETS) {
    console.log(`\n${"=".repeat(60)}`);

    // Find the primary anime record and its Link
    const primaryAnime = await db.anime.findUnique({
      where: { anilistId: targetAnilistId },
      include: {
        linkedIn: {
          include: {
            link: {
              include: {
                linkedAnime: { orderBy: { order: "asc" } },
                userEntry: { select: { currentEpisode: true, watchStatus: true } },
              },
            },
          },
        },
      },
    });

    if (!primaryAnime) {
      console.log(`[SKIP] anilistId=${targetAnilistId}: not found in DB`);
      continue;
    }

    const title = primaryAnime.titleEnglish ?? primaryAnime.titleRomaji;
    console.log(`[PROCESS] "${title}" (db id=${primaryAnime.id}, anilistId=${targetAnilistId})`);

    if (primaryAnime.linkedIn.length === 0) {
      console.log(`  [SKIP] Not in any Link`);
      continue;
    }

    const link = primaryAnime.linkedIn[0].link;
    const userEntry = link.userEntry;
    console.log(`  Link #${link.id} — ${link.linkedAnime.length} entries, currentEpisode=${userEntry?.currentEpisode ?? 0}, status=${userEntry?.watchStatus}`);

    // Resolve the AniList ID to use for chain traversal.
    // If the DB entry is an OVA (like KONOSUBA's Choker), find the real main series ID.
    let chainStartAnilistId = targetAnilistId;
    const mainSeriesId = await resolveMainSeriesId(targetAnilistId);
    if (mainSeriesId !== null) {
      chainStartAnilistId = mainSeriesId;

      // Check if the main series record already exists in DB
      const existingMainRecord = await db.anime.findUnique({ where: { anilistId: mainSeriesId } });

      if (existingMainRecord) {
        // Main series record already exists — swap the LinkedAnime to point to it
        // (can't update anilistId on the OVA record due to unique constraint)
        console.log(`  → Main series (anilistId=${mainSeriesId}) already in DB as id=${existingMainRecord.id}. Swapping LinkedAnime reference.`);
        await db.linkedAnime.updateMany({
          where: { linkId: link.id, animeId: primaryAnime.id },
          data: { animeId: existingMainRecord.id },
        });
        // Re-sync main series data from AniList
        const mainData = await fetchAniListById(mainSeriesId);
        if (mainData) {
          const updates = mapAniListToAnimeData(mainData);
          const tmdbUpdate = existingMainRecord.tmdbId ? {} : { tmdbId: primaryAnime.tmdbId, tmdbMediaType: primaryAnime.tmdbMediaType };
          await db.anime.update({
            where: { id: existingMainRecord.id },
            data: {
              titleEnglish: updates.titleEnglish,
              titleRomaji: updates.titleRomaji,
              totalEpisodes: updates.totalEpisodes,
              airingStatus: updates.airingStatus,
              totalSeasons: 1,
              ...tmdbUpdate,
            },
          });
          console.log(`  → Re-synced main series: "${mainData.title.english ?? mainData.title.romaji}" (${mainData.episodes} eps)`);
        }
      } else {
        // Main series doesn't exist yet — update the anilistId on the OVA record
        const mainData = await fetchAniListById(mainSeriesId);
        if (mainData) {
          const updates = mapAniListToAnimeData(mainData);
          await db.anime.update({
            where: { id: primaryAnime.id },
            data: {
              anilistId: mainSeriesId,
              titleEnglish: updates.titleEnglish,
              titleRomaji: updates.titleRomaji,
              totalEpisodes: updates.totalEpisodes,
              airingStatus: updates.airingStatus,
            },
          });
          console.log(`  → Updated anilistId ${targetAnilistId} → ${mainSeriesId}, title="${mainData.title.english ?? mainData.title.romaji}", totalEpisodes=${mainData.episodes}`);
        }
      }
    }

    // Traverse the season chain
    console.log(`  Traversing AniList chain from ${chainStartAnilistId}...`);
    const earliestId = await findEarliestInChain(chainStartAnilistId);
    const chain = await buildSeasonChain(earliestId);

    if (chain.length === 0) {
      console.log(`  [SKIP] No TV entries found in chain`);
      continue;
    }

    if (chain.length === 1) {
      // Single AniList entry — re-sync data but no linking needed
      const s = chain[0];
      const updates = mapAniListToAnimeData(s);
      await db.anime.update({
        where: { id: primaryAnime.id },
        data: {
          totalEpisodes: updates.totalEpisodes,
          airingStatus: updates.airingStatus,
        },
      });
      console.log(`  [SINGLE ENTRY] "${s.title.english ?? s.title.romaji}" — re-synced totalEpisodes=${s.episodes}. No season linking possible.`);
      continue;
    }

    console.log(`  Found ${chain.length} seasons:`);
    chain.forEach((s, i) =>
      console.log(`    S${i + 1}: [${s.id}] "${s.title.english ?? s.title.romaji}" (${s.episodes ?? "?"} eps)`)
    );

    // Process each season: find/create DB record + upsert LinkedAnime
    for (let i = 0; i < chain.length; i++) {
      const seasonData = chain[i];

      // Find or create the Anime record for this season
      let dbRecord = await db.anime.findUnique({ where: { anilistId: seasonData.id } });

      if (!dbRecord) {
        const data = mapAniListToAnimeData(seasonData);
        // Inherit tmdbId from primary anime (same series, offset-based fetching)
        dbRecord = await db.anime.create({
          data: { ...data, tmdbId: primaryAnime.tmdbId, tmdbMediaType: primaryAnime.tmdbMediaType },
        });
        console.log(`  → Created DB record for S${i + 1}: "${seasonData.title.english ?? seasonData.title.romaji}" (db id=${dbRecord.id})`);
      } else {
        // Re-sync key AniList fields (don't overwrite tmdbId or manually-set fields)
        const updates = mapAniListToAnimeData(seasonData);
        // Only inherit tmdbId if the record doesn't have one yet
        const tmdbUpdate = dbRecord.tmdbId ? {} : { tmdbId: primaryAnime.tmdbId, tmdbMediaType: primaryAnime.tmdbMediaType };
        await db.anime.update({
          where: { id: dbRecord.id },
          data: {
            titleEnglish: updates.titleEnglish,
            titleRomaji: updates.titleRomaji,
            totalEpisodes: updates.totalEpisodes,
            airingStatus: updates.airingStatus,
            totalSeasons: 1, // Each entry is now its own season
            ...tmdbUpdate,
          },
        });
        console.log(`  → Re-synced S${i + 1} (db id=${dbRecord.id}): totalEpisodes=${seasonData.episodes}`);
      }

      // If this season is in a different Link, warn but do NOT move automatically
      const otherLinks = await db.linkedAnime.findMany({
        where: { animeId: dbRecord.id, linkId: { not: link.id } },
      });
      if (otherLinks.length > 0) {
        console.log(`  ⚠ S${i + 1} (db id=${dbRecord.id}) is already in ${otherLinks.length} other Link(s) — skipping to avoid data loss`);
        continue;
      }

      // Upsert LinkedAnime with correct order position
      await db.linkedAnime.upsert({
        where: { linkId_animeId: { linkId: link.id, animeId: dbRecord.id } },
        create: { linkId: link.id, animeId: dbRecord.id, order: i },
        update: { order: i },
      });
    }

    // Final state summary
    const finalLink = await db.link.findUnique({
      where: { id: link.id },
      include: {
        linkedAnime: {
          orderBy: { order: "asc" },
          include: {
            anime: { select: { titleEnglish: true, titleRomaji: true, totalEpisodes: true } },
          },
        },
        userEntry: { select: { currentEpisode: true } },
      },
    });
    const totalVirtualEps = finalLink?.linkedAnime.reduce(
      (sum, la) => sum + (la.anime.totalEpisodes ?? 0),
      0
    ) ?? 0;
    console.log(
      `  ✓ Link #${link.id}: ${finalLink?.linkedAnime.length} seasons, ${totalVirtualEps} virtual total eps, currentEpisode=${finalLink?.userEntry?.currentEpisode}`
    );
    finalLink?.linkedAnime.forEach((la) =>
      console.log(
        `    [${la.order}] "${la.anime.titleEnglish ?? la.anime.titleRomaji}" (${la.anime.totalEpisodes ?? "?"} eps)`
      )
    );
  }
}

main().catch(console.error).finally(() => db.$disconnect());
