import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); dotenv.config({ path: ".env" });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);

async function main() {
  const entries = await prisma.userEntry.findMany({
    where: {
      watchStatus: { in: ['COMPLETED', 'WATCHING', 'DROPPED'] }
    },
    include: {
      link: {
        include: {
          linkedAnime: {
            include: { anime: true },
            orderBy: { order: 'asc' }
          }
        }
      }
    },
    orderBy: { id: 'asc' }
  });

  for (const e of entries) {
    const titles = e.link?.linkedAnime?.map((la: any) => la.anime.titleEnglish || la.anime.titleRomaji) ?? [];
    const seasons = e.link?.linkedAnime?.reduce((s: number, la: any) => s + (la.anime.totalSeasons ?? 1), 0) ?? null;
    console.log(JSON.stringify({
      id: e.id,
      status: e.watchStatus,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      titles,
      seasons
    }));
  }
}

main().finally(() => prisma.$disconnect());
