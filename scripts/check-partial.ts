/**
 * Lists COMPLETED entries where currentEpisode < totalEpisodes (partially watched).
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); dotenv.config({ path: ".env" });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);
db.userEntry.findMany({
  where: { watchStatus: "COMPLETED" },
  include: { anime: { select: { titleEnglish: true, titleRomaji: true, totalEpisodes: true, airingStatus: true } } },
}).then(entries => {
  const partial = entries.filter(e => e.anime.totalEpisodes && e.currentEpisode > 0 && e.currentEpisode < e.anime.totalEpisodes);
  console.log(`\nCOMPLETED entries where currentEpisode < totalEpisodes:\n`);
  partial.forEach(e => console.log(`  db#${e.id} "${e.anime.titleEnglish ?? e.anime.titleRomaji}" — ep ${e.currentEpisode}/${e.anime.totalEpisodes} (airing: ${e.anime.airingStatus})`));
  console.log(`\nTotal: ${partial.length}`);
  return db.$disconnect();
});
