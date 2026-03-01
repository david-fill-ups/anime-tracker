/**
 * Fix a single MANUAL anime by current title + correct AniList ID.
 * Usage: npx tsx scripts/fix-one.ts "<current title>" <anilistId>
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "../lib/anilist";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);

async function main() {
  const [, , currentTitle, rawId] = process.argv;
  if (!currentTitle || !rawId) {
    console.error("Usage: npx tsx scripts/fix-one.ts \"<current title>\" <anilistId>");
    process.exit(1);
  }
  const anilistId = parseInt(rawId, 10);

  const anime = await db.anime.findFirst({ where: { titleRomaji: currentTitle } });
  if (!anime) { console.error(`Not found: "${currentTitle}"`); await db.$disconnect(); return; }
  console.log(`Found db#${anime.id} "${anime.titleRomaji}" (source=${anime.source}, anilistId=${anime.anilistId})`);

  const collision = await db.anime.findUnique({ where: { anilistId } });
  if (collision && collision.id !== anime.id) {
    console.error(`anilistId ${anilistId} already used by db#${collision.id} "${collision.titleRomaji}"`);
    await db.$disconnect();
    return;
  }

  const data = await fetchAniListById(anilistId);
  if (!data) { console.error(`No AniList data for id ${anilistId}`); await db.$disconnect(); return; }

  await db.anime.update({
    where: { id: anime.id },
    data: {
      anilistId: data.id, source: "ANILIST",
      titleRomaji: data.title.romaji, titleEnglish: data.title.english ?? null,
      titleNative: data.title.native ?? null, coverImageUrl: data.coverImage.large,
      synopsis: data.description ?? null, genres: JSON.stringify(data.genres),
      totalEpisodes: data.episodes ?? null, durationMins: data.duration ?? null,
      airingStatus: data.status, displayFormat: mapDisplayFormat(data.format),
      sourceMaterial: mapSourceMaterial(data.source),
      season: data.season ?? null, seasonYear: data.seasonYear ?? null,
      meanScore: data.meanScore ?? null, lastSyncedAt: new Date(),
    },
  });
  for (const edge of data.studios.edges) {
    const studio = await db.studio.upsert({
      where: { anilistStudioId: edge.node.id },
      create: { name: edge.node.name, anilistStudioId: edge.node.id },
      update: { name: edge.node.name },
    });
    await db.animeStudio.upsert({
      where: { animeId_studioId: { animeId: anime.id, studioId: studio.id } },
      create: { animeId: anime.id, studioId: studio.id, isMainStudio: edge.isMain },
      update: { isMainStudio: edge.isMain },
    });
  }

  console.log(`Fixed → "${data.title.english ?? data.title.romaji}" (anilistId ${data.id})`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
