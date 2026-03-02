/**
 * Find anime without a TMDB ID, search TMDB for each, and report matches.
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

async function tmdbFetch<T>(path: string): Promise<T | null> {
  if (!TOKEN) { console.warn("TMDB_API_TOKEN not set"); return null; }
  const res = await fetch(`${TMDB_BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    console.warn(`  TMDB ${res.status} for ${path}`);
    return null;
  }
  return res.json() as Promise<T>;
}

interface TmdbSearchResult {
  id: number;
  name?: string;
  title?: string;
  first_air_date?: string;
  release_date?: string;
}

async function searchTmdb(
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
      streamingCheckedAt: true,
    },
    orderBy: { titleRomaji: "asc" },
  });

  console.log(`Found ${anime.length} anime without a TMDB ID.\n`);

  const matched: Array<{ dbId: number; title: string; tmdbId: number; mediaType: string }> = [];
  const unmatched: Array<{ dbId: number; title: string }> = [];

  for (const a of anime) {
    const searchTitle = a.titleEnglish ?? a.titleRomaji;
    const mediaType: "tv" | "movie" = a.displayFormat === "MOVIE" ? "movie" : "tv";
    const result = await searchTmdb(searchTitle, mediaType, a.seasonYear);

    if (result) {
      const displayName = result.name ?? result.title ?? "?";
      const year = (result.first_air_date ?? result.release_date ?? "").split("-")[0];
      console.log(`  [MATCH]   db#${a.id}  "${searchTitle}"  →  TMDB ${mediaType}/${result.id}  "${displayName}" (${year})`);
      matched.push({ dbId: a.id, title: searchTitle, tmdbId: result.id, mediaType });

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

    // Polite rate-limit — TMDB allows ~50 req/s but let's be gentle
    await new Promise((r) => setTimeout(r, 100));
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
