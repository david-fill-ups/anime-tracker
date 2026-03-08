/**
 * One-time data migration: converts the old mergedIntoId-based "linked anime"
 * system to the new Link / LinkedAnime model.
 *
 * For each UserEntry (which always belongs to a primary anime):
 *   1. Create a Link (owned by the same userId)
 *   2. Create LinkedAnime for the primary anime (order 0)
 *   3. Create LinkedAnime for each secondary anime (mergedIntoId → primary), ordered by mergeOrder
 *   4. Set UserEntry.linkId = Link.id
 *
 * Safe to run multiple times — skips entries that already have a linkId.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any);

async function main() {
  const entries = await db.userEntry.findMany({
    include: {
      anime: {
        include: {
          mergedAnimes: { orderBy: { mergeOrder: "asc" } },
        },
      },
    },
  });

  console.log(`Found ${entries.length} UserEntry records to migrate.`);
  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (entry.linkId !== null) {
      console.log(`  [skip] UserEntry ${entry.id} already has linkId ${entry.linkId}`);
      skipped++;
      continue;
    }

    const anime = entry.anime;
    if (!anime) {
      console.warn(`  [warn] UserEntry ${entry.id} has no anime — skipping`);
      skipped++;
      continue;
    }

    // Create Link
    const link = await db.link.create({
      data: { userId: entry.userId },
    });

    // Primary anime at order 0
    await db.linkedAnime.create({
      data: { linkId: link.id, animeId: anime.id, order: 0 },
    });

    // Secondary (merged) anime at order 1+
    for (const secondary of anime.mergedAnimes) {
      await db.linkedAnime.create({
        data: { linkId: link.id, animeId: secondary.id, order: secondary.mergeOrder + 1 },
      });
    }

    // Wire up UserEntry to Link
    await db.userEntry.update({
      where: { id: entry.id },
      data: { linkId: link.id },
    });

    const merged = anime.mergedAnimes.length;
    console.log(
      `  [ok] Link ${link.id} → UserEntry ${entry.id} (${anime.titleRomaji}${merged > 0 ? ` + ${merged} linked` : ""})`
    );
    created++;
  }

  console.log(`\nMigration complete. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
