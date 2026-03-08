/**
 * Fix franchise errors from the auto-backfill:
 *  1. Delete all single-entry franchises
 *  2. Merge SAO: Alicization + Accel World into the SAO franchise
 *  3. Merge Yu-Gi-Oh! GX into Yu☆Gi☆Oh! → rename to "Yu-Gi-Oh"
 *  4. Create a Fate franchise from Fate/stay night + Fate/Zero
 *  5. Create an Avatar franchise from Avatar TLA + Legend of Korra
 *
 * Run: npx tsx scripts/fix-franchises.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter } as any);

const SEASON_OFFSET: Record<string, number> = { WINTER: 0, SPRING: 3, SUMMER: 6, FALL: 9 };

function computeOrder(seasonYear: number | null, season: string | null): number {
  if (!seasonYear) return 999999;
  return seasonYear * 100 + (SEASON_OFFSET[season ?? ""] ?? 0);
}

async function findAvailableOrder(franchiseId: number, baseOrder: number): Promise<number> {
  const used = await db.franchiseEntry.findMany({ where: { franchiseId }, select: { order: true } });
  const usedSet = new Set(used.map((e: any) => e.order));
  let order = baseOrder;
  while (usedSet.has(order)) order++;
  return order;
}

async function moveEntryToFranchise(
  animeId: number,
  targetFranchiseId: number,
  entryType: "MAIN" | "OVA" | "MOVIE" | "SIDE_STORY" = "MAIN"
): Promise<void> {
  const anime = await db.anime.findUnique({
    where: { id: animeId },
    select: { seasonYear: true, season: true, titleEnglish: true, titleRomaji: true },
  });
  if (!anime) throw new Error(`Anime id:${animeId} not found`);

  const existing = await db.franchiseEntry.findFirst({
    where: { franchiseId: targetFranchiseId, animeId },
  });
  if (existing) {
    console.log(`  already in franchise: ${(anime as any).titleEnglish ?? (anime as any).titleRomaji}`);
    return;
  }

  const baseOrder = computeOrder((anime as any).seasonYear, (anime as any).season);
  const order = await findAvailableOrder(targetFranchiseId, baseOrder);
  await db.franchiseEntry.create({
    data: { franchiseId: targetFranchiseId, animeId, order, entryType },
  });
  console.log(`  added: ${(anime as any).titleEnglish ?? (anime as any).titleRomaji} (order:${order})`);
}

async function deleteFranchise(franchiseId: number): Promise<void> {
  await db.franchiseEntry.deleteMany({ where: { franchiseId } });
  await db.franchise.delete({ where: { id: franchiseId } });
}

async function main() {
  // ── 1. Diagnose ───────────────────────────────────────────────────────────
  const allFranchises = await db.franchise.findMany({
    include: { entries: { include: { anime: { select: { titleEnglish: true, titleRomaji: true } } } } },
  });

  const singleEntry = (allFranchises as any[]).filter((f: any) => f.entries.length === 1);
  console.log(`Total franchises: ${allFranchises.length}`);
  console.log(`Single-entry franchises: ${singleEntry.length}`);

  // ── 2. Merge SAO: Alicization into SAO franchise ─────────────────────────
  // SAO franchise id:60, Alicization franchise id:117, Accel World franchise id:4
  const alicizationFranchise = await db.franchise.findUnique({
    where: { id: 117 },
    include: { entries: true },
  });
  const accelWorldFranchise = await db.franchise.findUnique({
    where: { id: 4 },
    include: { entries: true },
  });

  if (alicizationFranchise) {
    console.log("\n── Merging SAO: Alicization into SAO franchise ──");
    for (const entry of (alicizationFranchise as any).entries) {
      await moveEntryToFranchise(entry.animeId, 60, entry.entryType);
    }
    await deleteFranchise(117);
    console.log("  deleted Alicization franchise");
  }

  if (accelWorldFranchise) {
    console.log("\n── Adding Accel World to SAO franchise ──");
    for (const entry of (accelWorldFranchise as any).entries) {
      await moveEntryToFranchise(entry.animeId, 60, entry.entryType);
    }
    await deleteFranchise(4);
    console.log("  deleted Accel World standalone franchise");
  }

  // ── 3. Merge Yu-Gi-Oh GX into Yu☆Gi☆Oh! → rename to "Yu-Gi-Oh" ──────────
  // Yu☆Gi☆Oh! franchise id:71, Yu-Gi-Oh! GX franchise id:70
  const gxFranchise = await db.franchise.findUnique({
    where: { id: 70 },
    include: { entries: true },
  });

  if (gxFranchise) {
    console.log("\n── Merging Yu-Gi-Oh! GX into Yu☆Gi☆Oh! franchise ──");
    for (const entry of (gxFranchise as any).entries) {
      await moveEntryToFranchise(entry.animeId, 71, entry.entryType);
    }
    await deleteFranchise(70);
    console.log("  deleted GX standalone franchise");
  }

  // Rename Yu☆Gi☆Oh! franchise to "Yu-Gi-Oh"
  await db.franchise.update({ where: { id: 71 }, data: { name: "Yu-Gi-Oh" } });
  console.log("  renamed franchise to: Yu-Gi-Oh");

  // ── 4. Create Fate franchise ──────────────────────────────────────────────
  // Fate/stay night franchise id:80, Fate/Zero franchise id:82
  // Get the user ID from franchise 80
  const fateSN = await db.franchise.findUnique({
    where: { id: 80 },
    include: { entries: true },
  });
  const fateZero = await db.franchise.findUnique({
    where: { id: 82 },
    include: { entries: true },
  });

  if (fateSN && fateZero) {
    console.log("\n── Creating Fate franchise ──");
    const userId = (fateSN as any).userId;

    // Create new Fate franchise
    const fateFranchise = await db.franchise.create({
      data: { name: "Fate", userId },
    });

    // Add all entries from both
    for (const entry of [...(fateZero as any).entries, ...(fateSN as any).entries]) {
      await moveEntryToFranchise(entry.animeId, fateFranchise.id, entry.entryType);
    }
    await deleteFranchise(80);
    await deleteFranchise(82);
    console.log(`  created Fate franchise (id:${fateFranchise.id})`);
  }

  // ── 5. Create Avatar franchise ────────────────────────────────────────────
  // Search for Avatar TLA and Legend of Korra in DB
  const avatarAnimes = await db.anime.findMany({
    where: {
      OR: [
        { titleEnglish: { contains: "Avatar", mode: "insensitive" } },
        { titleRomaji: { contains: "Avatar", mode: "insensitive" } },
        { titleEnglish: { contains: "Korra", mode: "insensitive" } },
        { titleRomaji: { contains: "Korra", mode: "insensitive" } },
        { titleEnglish: { contains: "Airbender", mode: "insensitive" } },
        { titleRomaji: { contains: "Airbender", mode: "insensitive" } },
      ],
    },
    select: { id: true, titleEnglish: true, titleRomaji: true, anilistId: true, seasonYear: true, season: true, userEntries: { select: { userId: true } } },
  });

  console.log("\n── Avatar/Korra candidates found ──");
  for (const a of avatarAnimes as any[]) {
    const title = a.titleEnglish ?? a.titleRomaji;
    const inLib = a.userEntries.length > 0;
    console.log(`  ${inLib ? "✓" : "✗"} id:${a.id} ${title} (aid:${a.anilistId})`);
  }

  const libraryAvatars = (avatarAnimes as any[]).filter((a: any) => a.userEntries.length > 0);

  if (libraryAvatars.length >= 2) {
    const userId = libraryAvatars[0].userEntries[0].userId;

    // Check if Avatar franchise already exists
    const existingAvatarFranchise = await db.franchise.findFirst({
      where: { name: "Avatar", userId },
    });

    if (existingAvatarFranchise) {
      console.log(`  Avatar franchise already exists (id:${existingAvatarFranchise.id}), skipping`);
    } else {
      const avatarFranchise = await db.franchise.create({
        data: { name: "Avatar", userId },
      });
      for (const anime of libraryAvatars) {
        await moveEntryToFranchise(anime.id, avatarFranchise.id, "MAIN");
      }
      console.log(`  created Avatar franchise (id:${avatarFranchise.id}) with ${libraryAvatars.length} entries`);
    }
  } else if (libraryAvatars.length === 1) {
    console.log("  only 1 Avatar/Korra anime found in library — skipping franchise creation");
    console.log("  Make sure both are in your library first");
  } else {
    console.log("  no Avatar/Korra anime found in library — skipping");
  }

  // ── 6. Delete all remaining single-entry franchises ───────────────────────
  console.log("\n── Deleting single-entry franchises ──");
  const remainingFranchises = await db.franchise.findMany({
    include: { entries: true },
  });

  let deleted = 0;
  for (const f of remainingFranchises as any[]) {
    if (f.entries.length === 1) {
      await deleteFranchise(f.id);
      const entryAnime = await db.anime.findUnique({
        where: { id: f.entries[0].animeId },
        select: { titleEnglish: true, titleRomaji: true },
      }).catch(() => null);
      const title = (entryAnime as any)?.titleEnglish ?? (entryAnime as any)?.titleRomaji ?? "?";
      console.log(`  deleted: ${f.name} (was: ${title})`);
      deleted++;
    }
  }
  console.log(`  total deleted: ${deleted}`);

  // ── 7. Final summary ──────────────────────────────────────────────────────
  const finalFranchises = await db.franchise.findMany({
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: { anime: { select: { titleEnglish: true, titleRomaji: true, anilistId: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  console.log(`\n=== Final franchises (${finalFranchises.length}) ===`);
  for (const f of finalFranchises as any[]) {
    console.log(`[${f.entries.length} entries] ${f.name}`);
    for (const e of f.entries) {
      const title = e.anime.titleEnglish ?? e.anime.titleRomaji;
      console.log(`  [${e.entryType}] ${title}`);
    }
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
