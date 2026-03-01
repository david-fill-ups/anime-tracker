/**
 * Fixes typo'd MANUAL anime entries by fetching full AniList metadata by ID.
 * Run with: npx tsx scripts/fix-typos.ts
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
} from "../lib/anilist";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Map of current titleRomaji → correct AniList ID
// NOTE: "Frieren: Beyond Journey's End" is excluded — its ID conflicts with
// "Am I Actually the Strongest?" (154587) and needs to be confirmed.
const FIXES: Array<{ currentTitle: string; anilistId: number }> = [
  { currentTitle: "Am i really the strongest?", anilistId: 154587 },
  { currentTitle: "Welcome to Demon School! Irina Kun", anilistId: 107693 },
  { currentTitle: "The Reincarnation Of The Strongest Exorcist In Another World", anilistId: 146975 },
  { currentTitle: "The water magician", anilistId: 186052 },
  { currentTitle: "scooped up by an s-ranked adventurer", anilistId: 179885 },
  { currentTitle: "The misfit of demon king academy", anilistId: 112301 },
  { currentTitle: "The brilliant Healers new life in the shadows", anilistId: 175872 },
  { currentTitle: "grimgar, ashes and illusions", anilistId: 21428 },
  { currentTitle: "the do over damsel concur the dragon empower", anilistId: 164299 },
  { currentTitle: "Fate/Zero", anilistId: 10087 },
  { currentTitle: "Gnome Hunter", anilistId: 101165 },
  { currentTitle: "The Wrong Way to use Healing Magic", anilistId: 163481 },
  { currentTitle: "Rurouni Kenshin (2023 reboot)", anilistId: 142877 },
  { currentTitle: "villainess level 99: I may be the hidden boss but I'm not the demon king", anilistId: 156040 },
  { currentTitle: "Yamaha kun and the seven witches", anilistId: 20966 },
  { currentTitle: "Tokyo Ghoul", anilistId: 20605 },
  { currentTitle: "Fruits Basket", anilistId: 120 },
  { currentTitle: "Food Wars", anilistId: 20923 },
  { currentTitle: "Fire Force", anilistId: 105310 },
  { currentTitle: "Children of the Mud Whale", anilistId: 98441 },
];

async function upsertStudios(animeId: number, studios: { edges: { isMain: boolean; node: { id: number; name: string } }[] }) {
  for (const edge of studios.edges) {
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
  let fixed = 0, skipped = 0, failed = 0;

  for (const { currentTitle, anilistId } of FIXES) {
    process.stdout.write(`  "${currentTitle}" → `);

    const anime = await db.anime.findFirst({
      where: { titleRomaji: currentTitle, source: "MANUAL" },
    });

    if (!anime) {
      console.log("not found in DB, skipping");
      skipped++;
      continue;
    }

    // Check for anilistId collision with a different record
    const collision = await db.anime.findUnique({ where: { anilistId } });
    if (collision && collision.id !== anime.id) {
      console.log(`anilistId ${anilistId} already used by anime #${collision.id} ("${collision.titleRomaji}"), skipping`);
      skipped++;
      continue;
    }

    try {
      const data = await fetchAniListById(anilistId);
      await sleep(700);

      if (!data) {
        console.log(`no AniList data returned for id ${anilistId}, skipping`);
        skipped++;
        continue;
      }

      await db.anime.update({
        where: { id: anime.id },
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

      await upsertStudios(anime.id, data.studios);
      console.log(`fixed → "${data.title.english ?? data.title.romaji}" (id ${data.id})`);
      fixed++;
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`);
      failed++;
      await sleep(1000);
    }
  }

  console.log(`\nDone. fixed=${fixed}, skipped=${skipped}, failed=${failed}`);
  console.log(`\n⚠  Frieren: Beyond Journey's End was skipped — its AniList ID conflicts`);
  console.log(`   with "Am I Actually the Strongest?" (both listed as 154587).`);
  console.log(`   Confirm the correct Frieren ID and re-run with that entry added.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
