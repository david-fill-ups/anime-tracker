import type { AiringStatus } from "@/app/generated/prisma";

export function effectiveTotalEpisodes(anime: {
  totalEpisodes: number | null;
  mergedAnimes: { totalEpisodes: number | null }[];
}): number | null {
  const total =
    (anime.totalEpisodes ?? 0) +
    anime.mergedAnimes.reduce((s, m) => s + (m.totalEpisodes ?? 0), 0);
  return total > 0 ? total : null;
}

const STATUS_PRIORITY: AiringStatus[] = [
  "NOT_YET_RELEASED",
  "RELEASING",
  "HIATUS",
  "CANCELLED",
  "FINISHED",
];

export function effectiveAiringStatus(anime: {
  airingStatus: AiringStatus;
  mergedAnimes: { airingStatus: AiringStatus }[];
}): AiringStatus {
  const all = [anime.airingStatus, ...anime.mergedAnimes.map((m) => m.airingStatus)];
  return STATUS_PRIORITY.find((s) => all.includes(s)) ?? anime.airingStatus;
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
} as const;
