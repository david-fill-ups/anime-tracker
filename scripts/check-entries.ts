import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); dotenv.config({ path: ".env" });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);
const titles = process.argv.slice(2);
db.anime.findMany({ where: { titleRomaji: { in: titles.length ? titles : undefined } }, select: { id:true, titleRomaji:true, titleEnglish:true, anilistId:true, source:true, displayFormat:true }, orderBy: { titleRomaji: "asc" } })
  .then(r => { r.forEach(a => console.log(JSON.stringify(a))); return db.$disconnect(); });
