import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as any);

async function main() {
  // Fetch all links that have a UserEntry with progress
  const links = await db.link.findMany({
    where: {
      userEntry: { currentEpisode: { gt: 0 } },
    },
    include: {
      linkedAnime: {
        include: {
          anime: {
            select: {
              id: true,
              titleEnglish: true,
              titleRomaji: true,
              totalEpisodes: true,
              totalSeasons: true,
              episodesPerSeason: true,
              anilistId: true,
            },
          },
        },
        orderBy: { order: "asc" },
      },
      userEntry: {
        select: { currentEpisode: true, watchStatus: true },
      },
    },
  });

  // Keep only single-entry links where that anime has totalSeasons > 1
  const impacted = links.filter(
    (l) =>
      l.linkedAnime.length === 1 &&
      (l.linkedAnime[0].anime.totalSeasons ?? 1) > 1
  );

  if (impacted.length === 0) {
    console.log("No impacted anime found.");
    return;
  }

  console.log(`\nImpacted anime (single-entry links with totalSeasons > 1 and progress):\n`);
  for (const link of impacted) {
    const a = link.linkedAnime[0].anime;
    const ep = link.userEntry!.currentEpisode;
    const title = a.titleEnglish ?? a.titleRomaji;
    const seasons = a.totalSeasons ?? "?";
    const totalEps = a.totalEpisodes ?? "?";

    // Try to find S1 episode count from episodesPerSeason
    let s1Eps: number | null = null;
    if (a.episodesPerSeason) {
      try {
        const arr = JSON.parse(a.episodesPerSeason) as number[];
        s1Eps = arr[0] ?? null;
      } catch { /* ignore */ }
    }

    const beyondS1 = s1Eps !== null ? ep > s1Eps : null;
    const beyondNote = beyondS1 === true
      ? ` ← BEYOND S1 (S1 has ${s1Eps} eps)`
      : beyondS1 === false
        ? ` (within S1)`
        : ` (S1 ep count unknown)`;

    console.log(
      `  "${title}" — ep ${ep}/${totalEps} — ${seasons} seasons${beyondNote}` +
      `  [status: ${link.userEntry!.watchStatus}, anilistId: ${a.anilistId ?? "none"}]`
    );
  }

  console.log(`\nTotal: ${impacted.length}`);
}

main().catch(console.error).finally(() => db.$disconnect());
