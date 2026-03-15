import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); dotenv.config({ path: ".env" });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);

function d(s: string): Date { return new Date(s + "T00:00:00.000Z"); }

// COMPLETED entries: set both completedAt and startedAt (completedAt - seasons*7 days)
// Season counts from DB query output
const COMPLETED: Array<{ id: number; title: string; completedAt: string; startedAt: string }> = [
  { id: 1,   title: "Accel World",                        completedAt: "2021-09-18", startedAt: "2021-09-11" }, // 1 season
  { id: 3,   title: "Akame ga Kill!",                     completedAt: "2021-09-18", startedAt: "2021-09-11" }, // 1 season
  { id: 5,   title: "Akudama Drive",                      completedAt: "2021-09-18", startedAt: "2021-09-11" }, // 1 season
  { id: 7,   title: "Assassination Classroom",            completedAt: "2021-09-19", startedAt: "2021-08-22" }, // 4 seasons
  { id: 9,   title: "Avatar: The Last Airbender",         completedAt: "2021-09-19", startedAt: "2021-08-29" }, // 3 seasons
  { id: 10,  title: "The Legend of Korra",                completedAt: "2021-09-19", startedAt: "2021-08-22" }, // 4 seasons
  // Black Butler: CSV "Black Butler,2021-09-24" + "Black Butler: Emerald Witch Academy,2025-08-04"
  // DB entry covers all arcs including Emerald Witch → use latest CSV date as completedAt
  { id: 11,  title: "Black Butler (full franchise)",      completedAt: "2025-08-04", startedAt: "2025-04-21" }, // 15 seasons
  // Black Clover CSV: "Black Clover (Return),2025-02-25"
  { id: 12,  title: "Black Clover",                       completedAt: "2025-02-25", startedAt: "2025-02-11" }, // 2 seasons
  { id: 18,  title: "By the Grace of the Gods",           completedAt: "2021-10-10", startedAt: "2021-09-12" }, // 4 seasons
  { id: 21,  title: "Charlotte",                          completedAt: "2021-10-13", startedAt: "2021-10-06" }, // 1 season
  { id: 219, title: "Code Geass",                         completedAt: "2021-10-14", startedAt: "2021-09-23" }, // 3 seasons
  { id: 27,  title: "Death Note",                         completedAt: "2021-11-09", startedAt: "2021-11-02" }, // 1 season
  { id: 33,  title: "Dragon Ball",                        completedAt: "2021-11-27", startedAt: "2021-11-20" }, // 1 season
  { id: 36,  title: "Dragon Ball Z",                      completedAt: "2021-11-30", startedAt: "2021-09-28" }, // 9 seasons
  { id: 34,  title: "Dragon Ball GT",                     completedAt: "2021-12-18", startedAt: "2021-12-11" }, // 1 season
  { id: 35,  title: "Dragon Ball Super",                  completedAt: "2022-01-09", startedAt: "2022-01-02" }, // 1 season
  { id: 38,  title: "Fairy Tail",                         completedAt: "2022-02-07", startedAt: "2021-11-22" }, // 11 seasons
  { id: 113, title: "Fate/Zero",                          completedAt: "2022-04-25", startedAt: "2022-04-04" }, // 3 seasons
  { id: 40,  title: "Food Wars!",                         completedAt: "2022-08-01", startedAt: "2022-06-20" }, // 6 seasons
  { id: 44,  title: "Fullmetal Alchemist: Brotherhood",   completedAt: "2022-09-11", startedAt: "2022-09-04" }, // 1 season
  { id: 48,  title: "Hunter x Hunter (2011)",             completedAt: "2022-10-11", startedAt: "2022-09-20" }, // 3 seasons
  { id: 109, title: "KonoSuba",                           completedAt: "2023-01-08", startedAt: "2022-12-11" }, // 4 seasons
  // MHA CSV: "My Hero Academia,2023-04-23" + "My Hero Academia (Final Season),2025-02-13"
  // DB entry covers all seasons including Final → use latest CSV date
  { id: 61,  title: "My Hero Academia",                   completedAt: "2025-02-13", startedAt: "2024-09-12" }, // 22 seasons
  { id: 65,  title: "No Game, No Life",                   completedAt: "2023-05-09", startedAt: "2023-05-02" }, // 1 season
  { id: 69,  title: "Overlord",                           completedAt: "2023-08-11", startedAt: "2023-06-23" }, // 7 seasons
  { id: 77,  title: "The Seven Deadly Sins",              completedAt: "2023-09-12", startedAt: "2023-07-18" }, // 8 seasons
  { id: 81,  title: "Sword Art Online",                   completedAt: "2023-11-05", startedAt: "2023-09-03" }, // 9 seasons
  { id: 136, title: "The Misfit of Demon King Academy",   completedAt: "2024-01-15", startedAt: "2023-12-18" }, // 4 seasons
  { id: 90,  title: "The Promised Neverland",             completedAt: "2024-01-21", startedAt: "2023-12-31" }, // 3 seasons
  { id: 92,  title: "Tokyo Ghoul",                        completedAt: "2024-02-06", startedAt: "2023-12-19" }, // 7 seasons
  { id: 94,  title: "Vinland Saga",                       completedAt: "2024-02-11", startedAt: "2024-01-21" }, // 3 seasons
  { id: 97,  title: "Your lie in April",                  completedAt: "2024-02-12", startedAt: "2024-02-05" }, // 1 season
  { id: 101, title: "Zom 100",                            completedAt: "2024-02-17", startedAt: "2024-02-10" }, // 1 season
  // Tower of God: CSV only has "Tower of God S2,2024-05-26"; DB has S1+S2 combined
  { id: 125, title: "Tower of God",                       completedAt: "2024-05-26", startedAt: "2024-05-05" }, // 3 seasons
];

// WATCHING entries: set only startedAt (earliest CSV date for that franchise)
const WATCHING: Array<{ id: number; title: string; startedAt: string }> = [
  { id: 13,  title: "Bleach",                startedAt: "2021-09-28" },
  { id: 15,  title: "Blue Exorcist",         startedAt: "2021-09-30" },
  { id: 39,  title: "Fire Force",            startedAt: "2022-07-18" },
  { id: 50,  title: "DanMachi",              startedAt: "2022-10-17" },
  { id: 52,  title: "Jujutsu Kaisen",        startedAt: "2022-11-21" },
  { id: 53,  title: "Kaguya-sama",           startedAt: "2022-12-03" },
  { id: 59,  title: "Mushoku Tensei",        startedAt: "2023-03-11" },
  { id: 67,  title: "One Punch Man",         startedAt: "2023-07-28" },
  { id: 73,  title: "Re:Zero",               startedAt: "2023-08-26" },
  { id: 74,  title: "Shield Hero",           startedAt: "2023-10-01" },
  { id: 85,  title: "That Time I Got Reincarnated as a Slime", startedAt: "2023-12-10" },
  { id: 87,  title: "The Devil is a Part-Timer!", startedAt: "2023-12-15" },
  { id: 20,  title: "Chainsaw Man",          startedAt: "2024-03-04" },
  { id: 79,  title: "Solo Leveling",         startedAt: "2024-03-04" },
  { id: 103, title: "Frieren",               startedAt: "2024-03-05" },
  { id: 57,  title: "Mashle",                startedAt: "2024-03-09" },
  { id: 119, title: "Shangri-La Frontier",   startedAt: "2024-03-11" },
  { id: 130, title: "Kaiju No. 8",           startedAt: "2024-04-18" },
  { id: 46,  title: "Hell's Paradise",       startedAt: "2024-02-22" },
  { id: 112, title: "Oshi no Ko",            startedAt: "2024-06-13" },
  { id: 133, title: "Wistoria",              startedAt: "2024-06-30" },
  // DanDaDan: current startedAt is 2026-03-08 (wrong); CSV has Dandadan S1 completed 2024-12-25
  { id: 164, title: "DanDaDan",              startedAt: "2024-12-25" },
  // One Piece: only milestone entries in CSV; earliest is "One Piece (Egghead Finale),2025-03-22"
  { id: 66,  title: "One Piece",             startedAt: "2025-03-22" },
];

async function main() {
  console.log("=== Updating COMPLETED entries ===");
  for (const e of COMPLETED) {
    await db.userEntry.update({
      where: { id: e.id },
      data: { completedAt: d(e.completedAt), startedAt: d(e.startedAt) },
    });
    console.log(`  [${e.id}] ${e.title}: started ${e.startedAt}, completed ${e.completedAt}`);
  }

  console.log("\n=== Updating WATCHING entries (startedAt only) ===");
  for (const e of WATCHING) {
    await db.userEntry.update({
      where: { id: e.id },
      data: { startedAt: d(e.startedAt) },
    });
    console.log(`  [${e.id}] ${e.title}: started ${e.startedAt}`);
  }

  console.log("\nDone.");
}

main().finally(() => db.$disconnect());
