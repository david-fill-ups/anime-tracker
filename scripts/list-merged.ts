import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);
async function main() {
  const merged = await db.anime.findMany({
    where: { mergedIntoId: { not: null } },
    include: { mergedInto: { select: { titleEnglish: true, titleRomaji: true } } },
    orderBy: { mergedInto: { titleRomaji: "asc" } },
  });
  for (const m of merged) {
    const primary = m.mergedInto?.titleEnglish ?? m.mergedInto?.titleRomaji;
    const secondary = m.titleEnglish ?? m.titleRomaji;
    console.log(`  ${primary} <- ${secondary}`);
  }
  console.log(`\nTotal merged: ${merged.length}`);
  await db.$disconnect();
}
main().catch(console.error);
