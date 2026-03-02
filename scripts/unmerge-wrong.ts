/**
 * Unmerge incorrectly merged anime:
 * - Fate/stay night: UBW (S1+S2) from Fate/Zero  — different shows
 * - Yu-Gi-Oh! 5D's from Yu-Gi-Oh! GX             — different series
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);

async function unmergeByAnilistId(anilistId: number) {
  const anime = await db.anime.findUnique({ where: { anilistId } });
  if (!anime) { console.log(`  Not found: anilistId=${anilistId}`); return; }
  if (!anime.mergedIntoId) { console.log(`  Already unmerged: "${anime.titleEnglish ?? anime.titleRomaji}"`); return; }
  await db.anime.update({ where: { id: anime.id }, data: { mergedIntoId: null } });
  console.log(`  ✅ Unmerged: "${anime.titleEnglish ?? anime.titleRomaji}" (anilistId=${anilistId})`);
}

async function main() {
  console.log("Unmerging incorrectly merged anime...\n");

  console.log("Fate/stay night: Unlimited Blade Works (from Fate/Zero):");
  await unmergeByAnilistId(19603); // FSN:UBW S1
  await unmergeByAnilistId(20792); // FSN:UBW S2

  console.log("\nYu-Gi-Oh! 5D's (from Yu-Gi-Oh! GX):");
  // Find 5D's by searching for it in the DB
  const yugioh5ds = await db.anime.findFirst({ where: { titleRomaji: { contains: "5D" } } });
  if (yugioh5ds) {
    await db.anime.update({ where: { id: yugioh5ds.id }, data: { mergedIntoId: null } });
    console.log(`  ✅ Unmerged: "${yugioh5ds.titleEnglish ?? yugioh5ds.titleRomaji}"`);
  } else {
    console.log("  Yu-Gi-Oh! 5D's not found by title, searching merged...");
    const merged = await db.anime.findMany({
      where: { mergedIntoId: { not: null } },
      include: { mergedInto: { select: { titleEnglish: true, titleRomaji: true } } },
    });
    const gx = merged.find(m => (m.mergedInto?.titleRomaji ?? "").includes("GX"));
    if (gx) {
      await db.anime.update({ where: { id: gx.id }, data: { mergedIntoId: null } });
      console.log(`  ✅ Unmerged: "${gx.titleEnglish ?? gx.titleRomaji}"`);
    }
  }

  await db.$disconnect();
  console.log("\nDone.");
}

main().catch(console.error);
