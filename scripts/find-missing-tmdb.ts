/**
 * Find anime without a TMDB ID, search TMDB for each, and report matches.
 * Uses fuzzy suffix-stripping to handle "Season 2", "Second Season", subtitles, etc.
 *
 * Usage:
 *   npx tsx scripts/find-missing-tmdb.ts           # dry run — report only
 *   npx tsx scripts/find-missing-tmdb.ts --update  # save matched tmdbIds to DB
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);

const TMDB_BASE = "https://api.themoviedb.org/3";
const TOKEN = process.env.TMDB_API_TOKEN;

// Manual overrides for entries where regex stripping can't find the right title.
// Key: dbId, Value: { tmdbId, mediaType }
const MANUAL_OVERRIDES: Record<number, { tmdbId: number; mediaType: "tv" | "movie" }> = {
  // "Sailor Moon SuperS" — "SuperS" isn't a recognisable suffix; all Sailor Moon seasons live under tv/3570
  179: { tmdbId: 3570, mediaType: "tv" },
};

async function tmdbFetch<T>(path: string): Promise<T | null> {
  if (!TOKEN) { console.warn("TMDB_API_TOKEN not set"); return null; }
  const res = await fetch(`${TMDB_BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

interface TmdbSearchResult {
  id: number;
  name?: string;
  title?: string;
  first_air_date?: string;
  release_date?: string;
}

async function searchOnce(
  title: string,
  mediaType: "tv" | "movie",
  year: number | null
): Promise<TmdbSearchResult | null> {
  const encoded = encodeURIComponent(title);
  const yearParam = year
    ? mediaType === "tv" ? `&first_air_date_year=${year}` : `&year=${year}`
    : "";
  const data = await tmdbFetch<{ results: TmdbSearchResult[] }>(
    `/search/${mediaType}?query=${encoded}&include_adult=false${yearParam}`
  );
  if (!data || data.results.length === 0) return null;
  return data.results[0];
}

// Patterns stripped progressively until we get a TMDB match.
// Ordered from least to most aggressive.
const STRIP_PATTERNS: RegExp[] = [
  // "Season N" and everything after — covers "Season 2 Part 1", "Season 3: The Culling Game", etc.
  // No required leading separator so it handles "【OSHI NO KO】Season 3"
  /Season\s+\d+.*$/i,
  // Ordinal + Season: "2nd Season", "3rd Season Part 2", "Final Season"
  /[:\s]+\d+(st|nd|rd|th)\s+Season(\s+Part\s+\d+)?$/i,
  /[:\s]+(Second|Third|Fourth|Fifth|Final|The\s+Final)\s+Season$/i,
  // Cour — plain and parenthetical
  /[:\s]+Cour\s+\d+$/i,
  /\s*\(Cour\s+\d+\)\s*$/i,
  // Part N
  /[:\s]+Part\s+\d+$/i,
  // Roman numeral sequel at end: " II", " III", " IV", " V"
  /\s+(?:II|III|IV|V|VI)$/,
  // dash-enclosed subtitle at end: " -The First Kiss That Never Ends-"
  /\s+-[^-]+-\s*$/,
  // last colon subtitle where colon is followed by a space (safe — skips "Re:ZERO")
  /:\s+(?!.*:)[^:]+$/,
  // " - subtitle" at end: " - Owaranai Seraph"
  /\s+-\s+[^-]+$/,
  // trailing " 2", " 3", etc.
  /(?<=\S)\s+\d+$/,
];

function stripOne(title: string): string | null {
  for (const pat of STRIP_PATTERNS) {
    const stripped = title.replace(pat, "").trim();
    if (stripped !== title && stripped.length >= 3) return stripped;
  }
  return null;
}

async function searchTmdbFuzzy(
  title: string,
  mediaType: "tv" | "movie",
  year: number | null
): Promise<{ result: TmdbSearchResult; usedTitle: string } | null> {
  // 1. Exact match with year
  let result = await searchOnce(title, mediaType, year);
  if (result) return { result, usedTitle: title };

  // 2. Exact match without year
  if (year) {
    result = await searchOnce(title, mediaType, null);
    if (result) return { result, usedTitle: title };
  }

  // 3. Strip season/sequel suffixes progressively (up to 5 rounds)
  let current = title;
  for (let i = 0; i < 5; i++) {
    const stripped = stripOne(current);
    if (!stripped) break;
    result = await searchOnce(stripped, mediaType, null);
    if (result) return { result, usedTitle: stripped };
    current = stripped;
  }

  return null;
}

async function main() {
  const doUpdate = process.argv.includes("--update");

  const anime = await db.anime.findMany({
    where: { tmdbId: null },
    select: {
      id: true,
      titleRomaji: true,
      titleEnglish: true,
      displayFormat: true,
      seasonYear: true,
    },
    orderBy: { titleRomaji: "asc" },
  });

  console.log(`Found ${anime.length} anime without a TMDB ID.\n`);

  const matched: Array<{ dbId: number; title: string; tmdbId: number; mediaType: string; usedTitle: string }> = [];
  const unmatched: Array<{ dbId: number; title: string }> = [];

  for (const a of anime) {
    const searchTitle = a.titleEnglish ?? a.titleRomaji;
    const mediaType: "tv" | "movie" = a.displayFormat === "MOVIE" ? "movie" : "tv";

    // Check manual override first
    const override = MANUAL_OVERRIDES[a.id];
    if (override) {
      console.log(`  [OVERRIDE] db#${a.id}  "${searchTitle}"  →  TMDB ${override.mediaType}/${override.tmdbId}`);
      matched.push({ dbId: a.id, title: searchTitle, tmdbId: override.tmdbId, mediaType: override.mediaType, usedTitle: "(manual)" });
      if (doUpdate) {
        await db.anime.update({
          where: { id: a.id },
          data: { tmdbId: override.tmdbId, tmdbMediaType: override.mediaType },
        });
      }
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }

    const hit = await searchTmdbFuzzy(searchTitle, mediaType, a.seasonYear);

    if (hit) {
      const { result, usedTitle } = hit;
      const displayName = result.name ?? result.title ?? "?";
      const year = (result.first_air_date ?? result.release_date ?? "").split("-")[0];
      const note = usedTitle !== searchTitle ? ` (searched as: "${usedTitle}")` : "";
      console.log(`  [MATCH]    db#${a.id}  "${searchTitle}"  →  TMDB ${mediaType}/${result.id}  "${displayName}" (${year})${note}`);
      matched.push({ dbId: a.id, title: searchTitle, tmdbId: result.id, mediaType, usedTitle });

      if (doUpdate) {
        await db.anime.update({
          where: { id: a.id },
          data: { tmdbId: result.id, tmdbMediaType: mediaType },
        });
      }
    } else {
      console.log(`  [NO MATCH] db#${a.id}  "${searchTitle}" (${mediaType}, ${a.seasonYear ?? "year unknown"})`);
      unmatched.push({ dbId: a.id, title: searchTitle });
    }

    // Polite rate-limit
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`\n--- Summary ---`);
  console.log(`Matched:   ${matched.length}`);
  console.log(`Unmatched: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log("\nNeeds manual TMDB link:");
    for (const { dbId, title } of unmatched) {
      console.log(`  db#${dbId}  "${title}"`);
    }
  }

  if (!doUpdate && matched.length > 0) {
    console.log(`\nRe-run with --update to save the ${matched.length} matched TMDB IDs.`);
  } else if (doUpdate) {
    console.log(`\nSaved ${matched.length} TMDB IDs.`);
  }

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
