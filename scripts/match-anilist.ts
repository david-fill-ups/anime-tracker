/**
 * Matches MANUAL anime records to AniList by title search, then fills in full metadata.
 * Run with: npx tsx scripts/match-anilist.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  searchAniList,
  mapDisplayFormat,
  mapSourceMaterial,
  type AniListAnime,
} from "../lib/anilist";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Search with up to 3 retries on empty results (AniList rate-limits silently return []) */
async function searchWithRetry(title: string): Promise<AniListAnime[]> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const results = await searchAniList(title);
    if (results.length > 0) return results;
    if (attempt < 3) {
      const wait = attempt * 3000;
      process.stdout.write(`(retry ${attempt}, waiting ${wait / 1000}s) `);
      await sleep(wait);
    }
  }
  return [];
}

async function upsertStudios(animeId: number, data: AniListAnime) {
  for (const edge of data.studios.edges) {
    const studio = await db.studio.upsert({
      where: { anilistStudioId: edge.node.id },
      create: { name: edge.node.name, anilistStudioId: edge.node.id },
      update: { name: edge.node.name },
    });
    await db.animeStudio.upsert({
      where: { animeId_studioId: { animeId, studioId: studio.id } },
      create: { animeId, studioId: studio.id, isMainStudio: edge.isMain },
      update: { isMainStudio: edge.isMain },
    });
  }
}

async function main() {
  const manualAnime = await db.anime.findMany({
    where: { source: "MANUAL", anilistId: null },
    select: { id: true, titleRomaji: true },
    orderBy: { titleRomaji: "asc" },
  });

  console.log(`Found ${manualAnime.length} MANUAL anime to match\n`);

  let matched = 0, skipped = 0, failed = 0;

  for (const anime of manualAnime) {
    process.stdout.write(`  "${anime.titleRomaji}" → `);

    try {
      const results = await searchWithRetry(anime.titleRomaji);
      await sleep(700); // stay under 90 req/min

      if (results.length === 0) {
        console.log("no AniList results, skipping");
        skipped++;
        continue;
      }

      const best = results[0];
      console.log(
        `matched "${best.title.english ?? best.title.romaji}" (id ${best.id})`
      );

      // Check if another anime already has this anilistId (from a duplicate title in the import)
      const existing = await db.anime.findUnique({ where: { anilistId: best.id } });
      if (existing && existing.id !== anime.id) {
        console.log(`    ↳ anilistId ${best.id} already used by anime #${existing.id}, skipping`);
        skipped++;
        continue;
      }

      await db.anime.update({
        where: { id: anime.id },
        data: {
          anilistId: best.id,
          source: "ANILIST",
          titleRomaji: best.title.romaji,
          titleEnglish: best.title.english ?? null,
          titleNative: best.title.native ?? null,
          coverImageUrl: best.coverImage.large,
          synopsis: best.description ?? null,
          genres: JSON.stringify(best.genres),
          totalEpisodes: best.episodes ?? null,
          durationMins: best.duration ?? null,
          airingStatus: best.status,
          displayFormat: mapDisplayFormat(best.format),
          sourceMaterial: mapSourceMaterial(best.source),
          season: best.season ?? null,
          seasonYear: best.seasonYear ?? null,
          meanScore: best.meanScore ?? null,
          nextAiringEp: best.nextAiringEpisode?.episode ?? null,
          nextAiringAt: best.nextAiringEpisode
            ? new Date(best.nextAiringEpisode.airingAt * 1000)
            : null,
          lastSyncedAt: new Date(),
        },
      });

      await upsertStudios(anime.id, best);
      matched++;
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`);
      failed++;
      await sleep(1000);
    }
  }

  console.log(`\nDone. matched=${matched}, skipped=${skipped}, failed=${failed}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
