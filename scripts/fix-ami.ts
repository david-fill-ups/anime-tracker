import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "../lib/anilist";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);

async function main() {
  const cur = await db.anime.findUnique({ where: { id: 144 }, select: { id: true, titleRomaji: true, anilistId: true, source: true } });
  console.log("Current state:", cur);

  if (cur?.anilistId === 154391) {
    console.log("Already fixed!");
    await db.$disconnect();
    return;
  }

  const data = await fetchAniListById(154391);
  if (!data) { console.error("No AniList data for 154391"); await db.$disconnect(); return; }

  const r = await db.anime.update({
    where: { id: 144 },
    data: {
      anilistId: data.id,
      source: "ANILIST",
      titleRomaji: data.title.romaji,
      titleEnglish: data.title.english ?? null,
      titleNative: data.title.native ?? null,
      coverImageUrl: data.coverImage.large,
      synopsis: data.description ?? null,
      genres: JSON.stringify(data.genres),
      totalEpisodes: data.episodes ?? null,
      durationMins: data.duration ?? null,
      airingStatus: data.status,
      displayFormat: mapDisplayFormat(data.format),
      sourceMaterial: mapSourceMaterial(data.source),
      season: data.season ?? null,
      seasonYear: data.seasonYear ?? null,
      meanScore: data.meanScore ?? null,
      lastSyncedAt: new Date(),
    },
  });

  console.log(`Fixed: "${r.titleEnglish ?? r.titleRomaji}" (anilistId ${r.anilistId})`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
