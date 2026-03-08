/**
 * List all franchises with their entries (showing which are in user's library).
 * Run: npx tsx scripts/list-franchises.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter } as any);

async function main() {
  const franchises = await db.franchise.findMany({
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: {
          anime: {
            select: {
              id: true,
              titleEnglish: true,
              titleRomaji: true,
              anilistId: true,
              userEntries: { select: { watchStatus: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  for (const f of franchises as any[]) {
    const inLibrary = f.entries.filter((e: any) => e.anime.userEntries.length > 0);
    console.log(`[${f.entries.length} total / ${inLibrary.length} in lib] ${f.name} (id:${f.id})`);
    for (const e of f.entries) {
      const inLib = (e as any).anime.userEntries.length > 0 ? "✓" : "✗";
      const title = (e as any).anime.titleEnglish ?? (e as any).anime.titleRomaji;
      console.log(`  ${inLib} [${e.entryType}] ${title} (aid:${(e as any).anime.anilistId})`);
    }
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
