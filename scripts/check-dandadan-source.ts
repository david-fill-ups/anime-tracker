import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchAniListById } from "../lib/anilist";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);
async function main() {
  const row = await db.anime.findFirst({ where: { anilistId: 171018 }, select: { id: true, titleRomaji: true, source: true, anilistId: true, mergedIntoId: true } });
  console.log("DB row:", JSON.stringify(row));
  const data = await fetchAniListById(171018);
  const edges = data?.relations.edges.map((e) => ({ relationType: e.relationType, id: e.node.id, type: e.node.type, title: e.node.title.english ?? e.node.title.romaji }));
  console.log("Relations:", JSON.stringify(edges, null, 2));
  const s2 = await fetchAniListById(185660);
  console.log("S2 format:", s2?.format, "| title:", s2?.title.english ?? s2?.title.romaji);
  await db.$disconnect();
}
main().catch(console.error);
