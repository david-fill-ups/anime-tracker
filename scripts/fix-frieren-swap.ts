/**
 * Fixes the Am I Actually the Strongest? / Frieren ID swap.
 * - The entry currently at anilistId=154587 is actually Frieren — it was
 *   originally the "Am i really the strongest?" MANUAL row and got set to
 *   Frieren data by mistake. Re-fetch it as Am I Actually the Strongest (110769).
 * - The original "Frieren: Beyond Journey's End" MANUAL entry (no anilistId)
 *   should be set to 154587.
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

async function applyFix(animeId: number, anilistId: number) {
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
  // Step 1: find the entry currently wrongly set to anilistId=154587
  const wrongEntry = await db.anime.findUnique({ where: { anilistId: 154587 } });
  if (!wrongEntry) {
    console.log("No entry found at anilistId=154587 — nothing to swap.");
    await db.$disconnect();
    return;
  }
  console.log(`Found entry id=${wrongEntry.id} at anilistId=154587 ("${wrongEntry.titleRomaji}")`);

  // Temporarily clear its anilistId so we can assign 154587 to Frieren
  await db.anime.update({ where: { id: wrongEntry.id }, data: { anilistId: null, source: "MANUAL" } });
  console.log("  Cleared anilistId temporarily.");

  // Step 2: find the original Frieren MANUAL entry
  const frierenEntry = await db.anime.findFirst({
    where: { titleRomaji: "Frieren: Beyond Journey's End", source: "MANUAL", anilistId: null },
  });
  if (!frierenEntry) {
    console.log("⚠  No MANUAL Frieren entry found — it may need to be handled manually.");
  } else {
    console.log(`Found Frieren MANUAL entry id=${frierenEntry.id}, updating to anilistId=154587...`);
    const frierenData = await applyFix(frierenEntry.id, 154587);
    await sleep(700);
    console.log(`  ✓ Frieren → "${frierenData.title.english ?? frierenData.title.romaji}" (id 154587)`);
  }

  // Step 3: fix the wrong entry to Am I Actually the Strongest (110769)
  console.log(`Updating entry id=${wrongEntry.id} to Am I Actually the Strongest (110769)...`);
  await sleep(700);
  const amIData = await applyFix(wrongEntry.id, 110769);
  console.log(`  ✓ "${amIData.title.english ?? amIData.title.romaji}" (id 110769)`);

  console.log("\nDone.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
