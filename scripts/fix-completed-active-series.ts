/**
 * Fix UserEntry records marked COMPLETED where the anime is still RELEASING or HIATUS.
 * These should be WATCHING since the series isn't finished.
 *
 * Run with: npx tsx scripts/fix-completed-active-series.ts
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
      anime: { airingStatus: { in: ["RELEASING", "HIATUS"] } },
    },
    include: {
      anime: { select: { titleEnglish: true, titleRomaji: true, airingStatus: true } },
    },
  });

  if (entries.length === 0) {
    console.log("No entries to fix.");
    await db.$disconnect();
    return;
  }

  console.log(`Found ${entries.length} entries to fix:\n`);

  for (const e of entries) {
    const title = e.anime.titleEnglish ?? e.anime.titleRomaji;
    await db.userEntry.update({ where: { id: e.id }, data: { watchStatus: "WATCHING" } });
    console.log(`  ✓ "${title}" [${e.anime.airingStatus}] → WATCHING`);
  }

  console.log(`\nDone. Updated ${entries.length} entries.`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
