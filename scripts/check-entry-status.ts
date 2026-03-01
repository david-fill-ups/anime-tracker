import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); dotenv.config({ path: ".env" });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);
db.userEntry.findMany({
  where: { anime: { titleEnglish: { contains: "DAN", mode: "insensitive" } } },
  include: { anime: { select: { titleEnglish: true, airingStatus: true } } },
}).then(r => { r.forEach(e => console.log(JSON.stringify({ entryId: e.id, watchStatus: e.watchStatus, airingStatus: e.anime.airingStatus, title: e.anime.titleEnglish }))); return db.$disconnect(); });
