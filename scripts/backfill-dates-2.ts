import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); dotenv.config({ path: ".env" });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);

function d(s: string): Date { return new Date(s + "T00:00:00.000Z"); }

async function main() {
  const updates: Array<{ id: number; title: string; data: any }> = [
    // FMA: user says "Fullmetal Alchemist" = Brotherhood — id:44 already has 2022-09-11, nothing to do

    // Mob Psycho 100 — id:221, 3 seasons, completed 2023-01-21
    { id: 221, title: "Mob Psycho 100",
      data: { completedAt: d("2023-01-21"), startedAt: d("2022-12-31") } },

    // Parasyte — id:70, 1 season, completed 2023-08-14
    { id: 70, title: "Parasyte -the maxim-",
      data: { completedAt: d("2023-08-14"), startedAt: d("2023-08-07") } },

    // Spy x Family — id:222, WATCHING, earliest CSV date 2024-03-04
    { id: 222, title: "SPY x FAMILY",
      data: { startedAt: d("2024-03-04") } },

    // Demon Slayer — id:223, COMPLETED, 5 seasons; latest CSV entry = Infinity Castle Movie 2025-05-26
    { id: 223, title: "Demon Slayer: Kimetsu no Yaiba",
      data: { completedAt: d("2025-05-26"), startedAt: d("2025-04-21") } },

    // Sakamoto Days — id:224, COMPLETED, 2 seasons; latest CSV = Part 2 2026-01-11
    { id: 224, title: "SAKAMOTO DAYS",
      data: { completedAt: d("2026-01-11"), startedAt: d("2025-12-28") } },

    // Vinland Saga S3 → ignore season identifier → id:94; update completedAt only (keep startedAt)
    { id: 94, title: "Vinland Saga (S3 complete)",
      data: { completedAt: d("2025-11-16") } },

    // Darwin's Game S2 → id:26; update completedAt, set startedAt (1 season)
    { id: 26, title: "Darwin's Game",
      data: { completedAt: d("2025-05-06"), startedAt: d("2025-04-29") } },

    // Hunter x Hunter (Election Arc Return) → id:48; update completedAt only (keep startedAt)
    { id: 48, title: "Hunter x Hunter",
      data: { completedAt: d("2025-09-25") } },

    // Fate/stay night UBW — id:110, DROPPED; set startedAt only, leave completedAt null
    { id: 110, title: "Fate/stay night: Unlimited Blade Works",
      data: { startedAt: d("2022-05-08") } },
  ];

  for (const e of updates) {
    await db.userEntry.update({ where: { id: e.id }, data: e.data });
    const keys = Object.keys(e.data).map(k => `${k}: ${e.data[k].toISOString().slice(0, 10)}`).join(", ");
    console.log(`  [${e.id}] ${e.title}: ${keys}`);
  }
  console.log("Done.");
}

main().finally(() => db.$disconnect());
