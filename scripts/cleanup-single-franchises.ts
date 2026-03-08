/**
 * Delete all single-entry franchises (franchises with only 1 anime).
 * These were incorrectly auto-created for standalone anime.
 *
 * Run: npx tsx scripts/cleanup-single-franchises.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter } as any);

async function main() {
  const allFranchises = await db.franchise.findMany({
    include: {
      entries: {
        include: { anime: { select: { titleEnglish: true, titleRomaji: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  console.log(`Total franchises: ${allFranchises.length}`);

  const single = (allFranchises as any[]).filter((f: any) => f.entries.length === 1);
  console.log(`Single-entry franchises: ${single.length}`);

  if (single.length === 0) {
    console.log("Nothing to clean up.");
    await db.$disconnect();
    return;
  }

  for (const f of single) {
    const anime = f.entries[0]?.anime;
    const animeTitle = anime?.titleEnglish ?? anime?.titleRomaji ?? "?";
    await db.franchiseEntry.deleteMany({ where: { franchiseId: f.id } });
    await db.franchise.delete({ where: { id: f.id } });
    console.log(`  deleted: "${f.name}" (was: ${animeTitle})`);
  }

  console.log(`\nDeleted ${single.length} single-entry franchise(s).`);

  const remaining = await db.franchise.count();
  console.log(`Franchises remaining: ${remaining}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
