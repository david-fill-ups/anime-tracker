/**
 * Second pass: handles shows that were rate-limited or had incomplete chains in the first run.
 * Also adds S5 for Daily Life of Immortal King (156110's sequel).
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

const MAIN_FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function findEarliestInChain(id: number): Promise<number> {
  const visited = new Set<number>();
  let current = id;
  while (!visited.has(current)) {
    visited.add(current);
    await sleep(700);
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

async function buildSeasonChain(startId: number): Promise<AniListAnime[]> {
  const chain: AniListAnime[] = [];
  const visited = new Set<number>();
  let current: number | null = startId;
  while (current !== null && !visited.has(current)) {
    visited.add(current);
    await sleep(700);
    const data = await fetchAniListById(current);
    if (!data) {
      console.log(`    (fetchAniListById(${current}) returned null — possible rate limit)`);
      break;
    }
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

const TARGETS: number[] = [
  114121, // Daily Life of Immortal King (check for S5)
  183133, // Unaware Atelier Meister
  97986,  // Made in Abyss
];

async function main() {
  for (const targetAnilistId of TARGETS) {
    console.log(`\n${"=".repeat(60)}`);
    await sleep(1000);

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

    console.log(`  Traversing AniList chain from ${targetAnilistId}...`);
    const earliestId = await findEarliestInChain(targetAnilistId);
    const chain = await buildSeasonChain(earliestId);

    if (chain.length === 0) {
      console.log(`  [SKIP] No main-series entries found in chain (AniList may be unavailable)`);
      continue;
    }

    if (chain.length === 1) {
      console.log(`  [SINGLE ENTRY] Only one TV/ONA entry found — no season linking possible`);
      continue;
    }

    console.log(`  Found ${chain.length} seasons:`);
    chain.forEach((s, i) =>
      console.log(`    S${i + 1}: [${s.id}] "${s.title.english ?? s.title.romaji}" (${s.episodes ?? "?"} eps)`)
    );

    for (let i = 0; i < chain.length; i++) {
      const seasonData = chain[i];

      let dbRecord = await db.anime.findUnique({ where: { anilistId: seasonData.id } });

      if (!dbRecord) {
        const data = mapAniListToAnimeData(seasonData);
        dbRecord = await db.anime.create({
          data: { ...data, tmdbId: primaryAnime.tmdbId, tmdbMediaType: primaryAnime.tmdbMediaType },
        });
        console.log(`  → Created S${i + 1}: "${seasonData.title.english ?? seasonData.title.romaji}" (db id=${dbRecord.id})`);
      } else {
        const updates = mapAniListToAnimeData(seasonData);
        const tmdbUpdate = dbRecord.tmdbId ? {} : { tmdbId: primaryAnime.tmdbId, tmdbMediaType: primaryAnime.tmdbMediaType };
        await db.anime.update({
          where: { id: dbRecord.id },
          data: {
            titleEnglish: updates.titleEnglish,
            titleRomaji: updates.titleRomaji,
            totalEpisodes: updates.totalEpisodes,
            airingStatus: updates.airingStatus,
            totalSeasons: 1,
            ...tmdbUpdate,
          },
        });
        console.log(`  → Re-synced S${i + 1} (db id=${dbRecord.id}): totalEpisodes=${seasonData.episodes}`);
      }

      const otherLinks = await db.linkedAnime.findMany({
        where: { animeId: dbRecord.id, linkId: { not: link.id } },
      });
      if (otherLinks.length > 0) {
        console.log(`  ⚠ S${i + 1} already in other Link(s) — skipping`);
        continue;
      }

      await db.linkedAnime.upsert({
        where: { linkId_animeId: { linkId: link.id, animeId: dbRecord.id } },
        create: { linkId: link.id, animeId: dbRecord.id, order: i },
        update: { order: i },
      });
    }

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
      console.log(`    [${la.order}] "${la.anime.titleEnglish ?? la.anime.titleRomaji}" (${la.anime.totalEpisodes ?? "?"} eps)`)
    );
    if ((finalLink?.userEntry?.currentEpisode ?? 0) > totalVirtualEps) {
      console.log(`  ⚠ WARNING: currentEpisode exceeds total virtual eps — more seasons may exist on AniList`);
    }
  }
}

main().catch(console.error).finally(() => db.$disconnect());
