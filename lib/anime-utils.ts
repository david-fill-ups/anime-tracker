import type { AiringStatus } from "@/app/generated/prisma";

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
  airingStatus: true,
  meanScore: true,
  synopsis: true,
  displayFormat: true,
} as const;

// ── Legacy merge-based utilities (kept during migration, remove after cleanup) ─

export function effectiveTotalEpisodes(anime: {
  totalEpisodes: number | null;
  mergedAnimes: { totalEpisodes: number | null }[];
}): number | null {
  const total =
    (anime.totalEpisodes ?? 0) +
    anime.mergedAnimes.reduce((s, m) => s + (m.totalEpisodes ?? 0), 0);
  return total > 0 ? total : null;
}

export function effectiveAiringStatus(anime: {
  airingStatus: AiringStatus;
  mergedAnimes: { airingStatus: AiringStatus }[];
}): AiringStatus {
  const all = [anime.airingStatus, ...anime.mergedAnimes.map((m) => m.airingStatus)];
  if (all.includes("RELEASING")) return "RELEASING";
  if (all.includes("HIATUS")) return "HIATUS";
  if (all.includes("CANCELLED")) return "CANCELLED";
  if (all.includes("FINISHED") && all.includes("NOT_YET_RELEASED")) return "HIATUS";
  if (all.includes("NOT_YET_RELEASED")) return "NOT_YET_RELEASED";
  return "FINISHED";
}

export const MERGED_ANIME_SELECT = {
  id: true,
  titleRomaji: true,
  titleEnglish: true,
  anilistId: true,
  season: true,
  seasonYear: true,
  totalEpisodes: true,
  airingStatus: true,
  mergeOrder: true,
} as const;
