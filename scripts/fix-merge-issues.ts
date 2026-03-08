/**
 * Fix remaining merge issues:
 * 1. Unmerge Fate/stay night: UBW from Fate/Zero (different shows)
 * 2. Unmerge Yu-Gi-Oh! 5D's from GX (different series)
 * 3. Manually merge MHA S4 (104276) and S5 (117193) which kept failing
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "../lib/anilist";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function unmergeByAnilistId(anilistId: number) {
  const anime = await db.anime.findUnique({ where: { anilistId } });
  if (!anime) { console.log(`  Not found: anilistId=${anilistId}`); return; }
  if (!anime.mergedIntoId) { console.log(`  Already unmerged: "${anime.titleEnglish ?? anime.titleRomaji}"`); return; }
  await db.anime.update({ where: { id: anime.id }, data: { mergedIntoId: null } });
  console.log(`  ✅ Unmerged: "${anime.titleEnglish ?? anime.titleRomaji}"`);
}

async function mergeAnilistIdInto(secondaryAnilistId: number, primaryAnilistId: number) {
  await sleep(1200);
  const primary = await db.anime.findUnique({ where: { anilistId: primaryAnilistId } });
  if (!primary) { console.log(`  Primary anilistId=${primaryAnilistId} not in DB`); return; }

  let secondary = await db.anime.findUnique({ where: { anilistId: secondaryAnilistId } });
  if (!secondary) {
    const data = await fetchAniListById(secondaryAnilistId);
    if (!data) { console.log(`  AniList fetch failed for id=${secondaryAnilistId}`); return; }
    secondary = await db.anime.create({
      data: {
        anilistId: data.id, source: "ANILIST",
        titleRomaji: data.title.romaji, titleEnglish: data.title.english ?? null,
        titleNative: data.title.native ?? null, coverImageUrl: data.coverImage.large,
        synopsis: data.description ?? null, genres: JSON.stringify(data.genres),
        totalEpisodes: data.episodes ?? null, durationMins: data.duration ?? null,
        airingStatus: data.status, displayFormat: mapDisplayFormat(data.format),
        sourceMaterial: mapSourceMaterial(data.source),
        season: data.season ?? null, seasonYear: data.seasonYear ?? null,
        meanScore: data.meanScore ?? null, lastSyncedAt: new Date(),
      },
    });
  }
  if (secondary.mergedIntoId === primary.id) {
    console.log(`  Already merged: "${secondary.titleEnglish ?? secondary.titleRomaji}"`); return;
  }
  await db.userEntry.deleteMany({ where: { animeId: secondary.id } });
  await db.anime.update({ where: { id: secondary.id }, data: { mergedIntoId: primary.id } });
  console.log(`  ✅ Merged "${secondary.titleEnglish ?? secondary.titleRomaji}" into "${primary.titleEnglish ?? primary.titleRomaji}"`);
}

async function main() {
  // 1. Unmerge FSN:UBW from Fate/Zero
  console.log("Unmerging Fate/stay night: UBW from Fate/Zero...");
  await unmergeByAnilistId(19603); // FSN:UBW S1
  await unmergeByAnilistId(20792); // FSN:UBW S2

  // 2. Unmerge Yu-Gi-Oh! 5D's from GX
  console.log("\nUnmerging Yu-Gi-Oh! 5D's from GX...");
  const yugioh5ds = await db.anime.findFirst({
    where: { mergedIntoId: { not: null }, OR: [{ titleEnglish: { contains: "5D" } }, { titleRomaji: { contains: "5D" } }] }
  });
  if (yugioh5ds) {
    await db.anime.update({ where: { id: yugioh5ds.id }, data: { mergedIntoId: null } });
    console.log(`  ✅ Unmerged: "${yugioh5ds.titleEnglish ?? yugioh5ds.titleRomaji}"`);
  } else {
    console.log("  5D's not found in merged list (already unmerged?)");
  }

  // 3. Merge MHA S4 and S5 into MHA S1
  console.log("\nMerging My Hero Academia S4 and S5...");
  await mergeAnilistIdInto(104276, 21459); // S4 into S1
  await mergeAnilistIdInto(117193, 21459); // S5 into S1

  await db.$disconnect();
  console.log("\nDone.");
}

main().catch(console.error);
