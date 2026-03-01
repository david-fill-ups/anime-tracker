import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); dotenv.config({ path: ".env" });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);
db.anime.findMany({ where: { source: "MANUAL", anilistId: null }, select: { id: true, titleRomaji: true }, orderBy: { titleRomaji: "asc" } })
  .then(r => { r.forEach(a => console.log(`${a.id}\t${a.titleRomaji}`)); return db.$disconnect(); });
