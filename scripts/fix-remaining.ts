/**
 * Fixes remaining mismatched entries.
 * Run with: npx tsx scripts/fix-remaining.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  fetchAniListById,
  mapDisplayFormat,
  mapSourceMaterial,
  type AniListAnime,
} from "../lib/anilist";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function fixById(animeId: number, anilistId: number) {
  const data = await fetchAniListById(anilistId);
  if (!data) throw new Error(`No AniList data for id ${anilistId}`);
  await db.anime.update({
    where: { id: animeId },
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
    },
  });
  await upsertStudios(animeId, data);
  return data;
}

async function main() {
  // ── 1. Reincarnation of the Strongest Exorcist — was wrongly set to 146975
  //       (IDOLMASTER). Correct ID is 144553. Find by current wrong anilistId.
  const reincarnation = await db.anime.findUnique({ where: { anilistId: 146975 } });
  if (reincarnation) {
    process.stdout.write(`  Reincarnation of Strongest Exorcist (db#${reincarnation.id}) → `);
    // Clear bad ID first to avoid unique conflict
    await db.anime.update({ where: { id: reincarnation.id }, data: { anilistId: null, source: "MANUAL" } });
    await sleep(700);
    const d = await fixById(reincarnation.id, 144553);
    console.log(`fixed → "${d.title.english ?? d.title.romaji}" (id 144553)`);
  } else {
    console.log("  Reincarnation entry not found at anilistId=146975, skipping");
  }

  await sleep(700);

  // ── 2. Villainess Level 99 — was wrongly set to 156040 (Most Heretical Last
  //       Boss Queen). Correct ID is 163076.
  const villainess = await db.anime.findUnique({ where: { anilistId: 156040 } });
  if (villainess) {
    process.stdout.write(`  Villainess Level 99 (db#${villainess.id}) → `);
    await db.anime.update({ where: { id: villainess.id }, data: { anilistId: null, source: "MANUAL" } });
    await sleep(700);
    const d = await fixById(villainess.id, 163076);
    console.log(`fixed → "${d.title.english ?? d.title.romaji}" (id 163076)`);
  } else {
    console.log("  Villainess entry not found at anilistId=156040, skipping");
  }

  await sleep(700);

  // ── 3. Am I Actually the Strongest? — entry id=144 was left as MANUAL with
  //       wrong title after the Frieren swap. Fix title + fetch AniList data.
  const amI = await db.anime.findFirst({
    where: { id: 144, source: "MANUAL" },
  });
  if (amI) {
    process.stdout.write(`  Am I Actually the Strongest? (db#${amI.id}) → `);
    const d = await fixById(amI.id, 110769);
    console.log(`fixed → "${d.title.english ?? d.title.romaji}" (id 110769)`);
  } else {
    // Already fixed or has a different state
    const check = await db.anime.findUnique({ where: { anilistId: 110769 } });
    if (check) {
      console.log(`  Am I Actually the Strongest? already at anilistId=110769 ("${check.titleRomaji}")`);
    } else {
      // Find it without anilistId and with the title we reset it to
      const byTitle = await db.anime.findFirst({
        where: { titleRomaji: "Am I Actually the Strongest?", anilistId: null },
      });
      if (byTitle) {
        process.stdout.write(`  Am I Actually the Strongest? (db#${byTitle.id}) → `);
        const d = await fixById(byTitle.id, 110769);
        console.log(`fixed → "${d.title.english ?? d.title.romaji}" (id 110769)`);
      } else {
        console.log("  Could not locate Am I Actually the Strongest? entry.");
      }
    }
  }

  console.log("\nDone.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
