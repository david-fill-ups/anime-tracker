import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); dotenv.config({ path: ".env" });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);
db.userEntry.findFirst({
  where: { anime: { anilistId: 171018 } },
  include: { anime: { select: { titleEnglish: true, totalEpisodes: true, airingStatus: true } } },
}).then(e => { console.log(JSON.stringify({ watchStatus: e?.watchStatus, currentEpisode: e?.currentEpisode, totalEpisodes: e?.anime.totalEpisodes, airingStatus: e?.anime.airingStatus })); return db.$disconnect(); });
