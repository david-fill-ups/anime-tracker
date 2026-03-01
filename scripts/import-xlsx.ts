/**
 * One-time import script: reads Weeb List (1).xlsx and inserts data into Neon.
 * Run with: npx tsx scripts/import-xlsx.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import * as XLSX from "xlsx";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any);

// ── Hardcoded for this import ────────────────────────────────────────────────
const USER_ID = "cmm83707m000090vbucc2031r";
const XLSX_PATH = "./tmp/Weeb List (1).xlsx";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse "S1 E24", "S3 E4", "S1", "S4.end", "finished season 1", etc.
 *  Returns the numeric episode if parseable, plus raw string for notes. */
function parseLastWatched(raw: string): { currentEpisode: number; rawNote: string } {
  if (!raw.trim()) return { currentEpisode: 0, rawNote: "" };

  // "S{n} E{n}" or "E{n}"
  const epMatch = raw.match(/E(\d+)/i);
  if (epMatch) {
    return { currentEpisode: parseInt(epMatch[1]), rawNote: "" };
  }

  // Unparseable — stash in notes so nothing is lost
  return { currentEpisode: 0, rawNote: `Last watched: ${raw.trim()}` };
}

function mapActiveStatus(raw: string): "WATCHING" | "COMPLETED" | "ON_HOLD" {
  switch (raw.toLowerCase().trim()) {
    case "active": return "WATCHING";
    case "hiatus": return "ON_HOLD";
    default: return "COMPLETED"; // "Completed" or blank
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const wb = XLSX.readFile(XLSX_PATH);

  // ── 1. Create Person records ─────────────────────────────────────────────
  const allPeople = ["Christine", "Matt", "Calvin"];
  const personMap = new Map<string, number>();

  for (const name of allPeople) {
    const p = await db.person.upsert({
      where: { name_userId: { name, userId: USER_ID } },
      create: { name, userId: USER_ID },
      update: {},
    });
    personMap.set(name, p.id);
    console.log(`Person: ${name} → id ${p.id}`);
  }

  // ── 2. Active / Completed tab ────────────────────────────────────────────
  const activeRows = (
    XLSX.utils.sheet_to_json(wb.Sheets["Active  Completed"], {
      header: 1,
      defval: "",
    }) as string[][]
  ).slice(1); // skip header

  let activeOk = 0, activeFail = 0;

  for (const row of activeRows) {
    const [title, lastWatched, , watchStatus, watchParty, note] = row;
    if (!title?.trim()) continue;

    const { currentEpisode, rawNote } = parseLastWatched(lastWatched ?? "");
    const status = mapActiveStatus(watchStatus ?? "");
    const watchContextPersonId = watchParty ? (personMap.get(watchParty) ?? null) : null;
    const combinedNote = [note?.trim(), rawNote].filter(Boolean).join(". ") || null;

    try {
      const anime = await db.anime.create({
        data: { titleRomaji: title.trim(), source: "MANUAL" },
      });
      await db.userEntry.create({
        data: {
          animeId: anime.id,
          userId: USER_ID,
          watchStatus: status,
          currentEpisode,
          notes: combinedNote,
          watchContextPersonId,
        },
      });
      activeOk++;
    } catch (e) {
      console.error(`  FAIL [active] "${title}": ${(e as Error).message}`);
      activeFail++;
    }
  }

  console.log(`\nActive/Completed: ${activeOk} imported, ${activeFail} failed`);

  // ── 3. Watch List tab ────────────────────────────────────────────────────
  const wlRows = (
    XLSX.utils.sheet_to_json(wb.Sheets["Watch List"], {
      header: 1,
      defval: "",
    }) as string[][]
  ).slice(1);

  let wlOk = 0, wlFail = 0;

  for (const row of wlRows) {
    const [title, recommendedBy, note] = row;
    if (!title?.trim()) continue;

    const recommenderId = recommendedBy ? (personMap.get(recommendedBy) ?? null) : null;
    const status = recommenderId ? "RECOMMENDED" : "PLAN_TO_WATCH";

    try {
      const anime = await db.anime.create({
        data: { titleRomaji: title.trim(), source: "MANUAL" },
      });
      await db.userEntry.create({
        data: {
          animeId: anime.id,
          userId: USER_ID,
          watchStatus: status,
          notes: note?.trim() || null,
          recommenderId,
        },
      });
      wlOk++;
    } catch (e) {
      console.error(`  FAIL [watchlist] "${title}": ${(e as Error).message}`);
      wlFail++;
    }
  }

  console.log(`Watch List: ${wlOk} imported, ${wlFail} failed`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
