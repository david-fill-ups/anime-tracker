/**
 * Two fixes:
 * 1. COMPLETED entries where currentEpisode > 0 but < totalEpisodes → WATCHING
 * 2. Specific anilistIds where S1 is FINISHED but S2 is upcoming → WATCHING
 *
 * Run with: npx tsx scripts/fix-watching-status.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);

// Shows that are "FINISHED" on AniList for S1 but have more content coming.
// Add more anilistIds here as needed.
const UPCOMING_SEASON_IDS = [
  171018, // DAN DA DAN — S2 upcoming
];

async function main() {
  let updated = 0;

  // ── 1. Partially-watched shows ───────────────────────────────────────────
  console.log("Fixing partially-watched COMPLETED entries...\n");
  const partial = await db.userEntry.findMany({
    where: { watchStatus: "COMPLETED" },
    include: { anime: { select: { titleEnglish: true, titleRomaji: true, totalEpisodes: true } } },
  });

  for (const e of partial) {
    if (!e.anime.totalEpisodes || e.currentEpisode === 0) continue;
    if (e.currentEpisode >= e.anime.totalEpisodes) continue;

    await db.userEntry.update({ where: { id: e.id }, data: { watchStatus: "WATCHING" } });
    console.log(`  ✓ "${e.anime.titleEnglish ?? e.anime.titleRomaji}" — ep ${e.currentEpisode}/${e.anime.totalEpisodes} → WATCHING`);
    updated++;
  }

  // ── 2. Shows with upcoming seasons ──────────────────────────────────────
  console.log("\nFixing 'S1 finished, S2 upcoming' entries...\n");
  for (const anilistId of UPCOMING_SEASON_IDS) {
    const entry = await db.userEntry.findFirst({
      where: { watchStatus: "COMPLETED", anime: { anilistId } },
      include: { anime: { select: { titleEnglish: true, titleRomaji: true } } },
    });
    if (!entry) { console.log(`  — anilistId ${anilistId}: no COMPLETED entry found`); continue; }

    await db.userEntry.update({ where: { id: entry.id }, data: { watchStatus: "WATCHING" } });
    console.log(`  ✓ "${entry.anime.titleEnglish ?? entry.anime.titleRomaji}" → WATCHING`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} entries.`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
