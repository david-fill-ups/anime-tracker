import type { AiringStatus } from "@/app/generated/prisma";
import { db } from "@/lib/db";

// ── Link-based utilities (new model) ─────────────────────────────────────────

type LinkedAnimeForCalc = {
  anime: { totalEpisodes: number | null; airingStatus: AiringStatus };
};

export function effectiveTotalEpisodesFromLink(
  linkedAnime: LinkedAnimeForCalc[]
): number | null {
  const total = linkedAnime.reduce((s, la) => s + (la.anime.totalEpisodes ?? 0), 0);
  return total > 0 ? total : null;
}

export function effectiveAiringStatusFromLink(
  linkedAnime: LinkedAnimeForCalc[]
): AiringStatus {
  const all = linkedAnime.map((la) => la.anime.airingStatus);
  if (all.includes("RELEASING")) return "RELEASING";
  if (all.includes("HIATUS")) return "HIATUS";
  if (all.includes("CANCELLED")) return "CANCELLED";
  if (all.includes("FINISHED") && all.includes("NOT_YET_RELEASED")) return "HIATUS";
  if (all.includes("NOT_YET_RELEASED")) return "NOT_YET_RELEASED";
  return "FINISHED";
}

// Accent-insensitive title search using PostgreSQL's unaccent extension.
// Returns all Anime IDs whose English or Romaji title matches the query
// regardless of accent marks (e.g. "Pokemon" matches "Pokémon").
export async function searchAnimeIdsByTitle(q: string): Promise<number[]> {
  const pattern = `%${q}%`;
  const rows = await db.$queryRaw<{ id: number }[]>`
    SELECT id FROM "Anime"
    WHERE unaccent(COALESCE("titleEnglish", '')) ILIKE unaccent(${pattern})
       OR unaccent(COALESCE("titleRomaji", '')) ILIKE unaccent(${pattern})
  `;
  return rows.map((r) => r.id);
}

// Select fields for a linked anime card
export const LINKED_ANIME_SELECT = {
  id: true,
  titleRomaji: true,
  titleEnglish: true,
  anilistId: true,
  coverImageUrl: true,
  season: true,
  seasonYear: true,
  totalEpisodes: true,
  totalSeasons: true,
  episodesPerSeason: true,
  tmdbId: true,
  tmdbMediaType: true,
  airingStatus: true,
  meanScore: true,
  synopsis: true,
  displayFormat: true,
  externalUrl: true,
  genres: true,
  startYear: true,
  startMonth: true,
  startDay: true,
} as const;

