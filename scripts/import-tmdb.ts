/**
 * Looks up Western animated shows on TMDB and fills in metadata for MANUAL entries.
 * Run with: npx tsx scripts/import-tmdb.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any);

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";
const TOKEN = process.env.TMDB_API_TOKEN!;

async function tmdb<T>(path: string): Promise<T> {
  const res = await fetch(`${TMDB_BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

interface TmdbSearchResult { id: number; name: string; first_air_date: string; }
interface TmdbTvDetails {
  id: number;
  name: string;
  overview: string;
  genres: { id: number; name: string }[];
  number_of_seasons: number;
  number_of_episodes: number;
  vote_average: number;
  status: string; // "Ended", "Returning Series", "Canceled", etc.
  first_air_date: string; // "YYYY-MM-DD"
  poster_path: string | null;
  seasons: { season_number: number; episode_count: number }[];
}

function mapStatus(s: string): "FINISHED" | "RELEASING" | "CANCELLED" | "HIATUS" | "NOT_YET_RELEASED" {
  switch (s) {
    case "Ended": return "FINISHED";
    case "Returning Series": return "RELEASING";
    case "Canceled": return "CANCELLED";
    case "In Production": return "NOT_YET_RELEASED";
    default: return "FINISHED";
  }
}

// dbId → TMDB search query (or null to look up by title from DB)
const ENTRIES: Array<{ dbId: number; searchQuery: string }> = [
  { dbId: 6,  searchQuery: "Arcane League of Legends" },
  { dbId: 10, searchQuery: "Avatar The Legend of Korra" },
  { dbId: 9,  searchQuery: "Avatar The Last Airbender" },
  { dbId: 31, searchQuery: "DOTA Dragon's Blood" },
];

async function main() {
  for (const { dbId, searchQuery } of ENTRIES) {
    const anime = await db.anime.findUnique({ where: { id: dbId } });
    if (!anime) { console.log(`db#${dbId} not found, skipping`); continue; }

    process.stdout.write(`  db#${dbId} "${anime.titleRomaji}" → `);

    const search = await tmdb<{ results: TmdbSearchResult[] }>(
      `/search/tv?query=${encodeURIComponent(searchQuery)}&include_adult=false`
    );

    if (!search.results.length) {
      console.log("no TMDB results");
      continue;
    }

    const hit = search.results[0];
    const details = await tmdb<TmdbTvDetails>(`/tv/${hit.id}`);

    const yearStr = details.first_air_date?.split("-")[0];
    const seasonYear = yearStr ? parseInt(yearStr) : null;
    const episodesPerSeason = details.seasons
      .filter((s) => s.season_number > 0)
      .sort((a, b) => a.season_number - b.season_number)
      .map((s) => s.episode_count);
    const totalEpisodes = episodesPerSeason.reduce((a, b) => a + b, 0) || details.number_of_episodes || null;
    const meanScore = details.vote_average ? Math.round(details.vote_average * 10) : null;
    const genres = details.genres.map((g) => g.name);

    await db.anime.update({
      where: { id: dbId },
      data: {
        tmdbId: details.id,
        tmdbMediaType: "tv",
        titleEnglish: details.name,
        titleRomaji: details.name,
        coverImageUrl: details.poster_path ? `${IMG_BASE}${details.poster_path}` : null,
        synopsis: details.overview || null,
        genres: JSON.stringify(genres),
        totalEpisodes,
        totalSeasons: details.number_of_seasons,
        episodesPerSeason: JSON.stringify(episodesPerSeason),
        airingStatus: mapStatus(details.status),
        displayFormat: "SERIES",
        seasonYear,
        meanScore,
        lastSyncedAt: new Date(),
      },
    });

    console.log(
      `"${details.name}" (tmdbId ${details.id}) — ${details.number_of_seasons} season(s), ${totalEpisodes} eps, status: ${details.status}`
    );
  }

  console.log("\nDone.");
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
