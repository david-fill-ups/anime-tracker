/**
 * Finds UserEntry records marked COMPLETED where the anime is still RELEASING,
 * and updates them to WATCHING.
 * Run with: npx tsx scripts/fix-releasing-status.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);

async function main() {
  const entries = await db.userEntry.findMany({
    where: {
      watchStatus: "COMPLETED",
      anime: { airingStatus: "RELEASING" },
    },
    include: { anime: { select: { titleEnglish: true, titleRomaji: true, airingStatus: true } } },
  });

  console.log(`Found ${entries.length} COMPLETED entries for still-RELEASING anime:\n`);

  for (const entry of entries) {
    const title = entry.anime.titleEnglish ?? entry.anime.titleRomaji;
    await db.userEntry.update({
      where: { id: entry.id },
      data: { watchStatus: "WATCHING" },
    });
    console.log(`  ✓ "${title}" → WATCHING`);
  }

  console.log(`\nDone. Updated ${entries.length} entries.`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
