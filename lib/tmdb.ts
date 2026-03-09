import { db } from "@/lib/db";
import type { StreamingService } from "@/app/generated/prisma";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TMDB_BASE = "https://api.themoviedb.org/3";
const REGION = process.env.STREAMING_REGION ?? "US";

// Search URL builders for auto-detected links
const SERVICE_SEARCH_URLS: Record<string, (q: string) => string> = {
  NETFLIX: (q) => `https://www.netflix.com/search?q=${q}`,
  HULU: (q) => `https://www.hulu.com/search?q=${q}`,
  DISNEY_PLUS: (q) => `https://www.disneyplus.com/search?q=${q}`,
  HBO: (q) => `https://www.max.com/search?q=${q}`,
  CRUNCHYROLL: (q) => `https://www.crunchyroll.com/search?q=${q}`,
  AMAZON_PRIME: (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`,
  HIDIVE: (q) => `https://www.hidive.com/search?q=${q}`,
};

// TMDB provider IDs → StreamingService enum values
const PROVIDER_MAP: Record<number, StreamingService> = {
  8: "NETFLIX",
  15: "HULU",
  337: "DISNEY_PLUS",
  384: "HBO",
  1899: "HBO",
  9: "AMAZON_PRIME",
  10: "AMAZON_PRIME",
  119: "AMAZON_PRIME",
  283: "CRUNCHYROLL",
  170: "HIDIVE",
};

// ---------------------------------------------------------------------------
// TMDB API types
// ---------------------------------------------------------------------------

interface TmdbSearchResult {
  id: number;
  name?: string;
  title?: string;
  first_air_date?: string;
  release_date?: string;
}

interface TmdbSearchResponse {
  results: TmdbSearchResult[];
}

interface TmdbProvider {
  provider_id: number;
  provider_name: string;
}

interface TmdbRegionData {
  link?: string;
  flatrate?: TmdbProvider[];
  free?: TmdbProvider[];
  ads?: TmdbProvider[];
}

interface TmdbWatchProvidersResponse {
  results: Record<string, TmdbRegionData>;
}

// ---------------------------------------------------------------------------
// Low-level fetch helper
// ---------------------------------------------------------------------------

async function tmdbFetch<T>(path: string): Promise<T | null> {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) {
    console.warn("[tmdb] TMDB_API_TOKEN is not set — skipping streaming lookup");
    return null;
  }

  const url = `${TMDB_BASE}${path}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        console.warn(`[tmdb] Rate limited (429) for ${url}. Retry-After: ${retryAfter ?? "unknown"}s`);
      } else {
        console.warn(`[tmdb] ${res.status} ${res.statusText} for ${url}`);
      }
      return null;
    }
    return res.json() as Promise<T>;
  } catch (err) {
    console.warn(`[tmdb] Network error fetching ${url}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// TV series details (season count)
// ---------------------------------------------------------------------------

interface TmdbTvDetails {
  number_of_seasons: number;
  seasons: Array<{
    season_number: number;
    episode_count: number;
  }>;
}

// Resolves TMDB ID if needed, then populates totalSeasons from TMDB.
// No-ops if totalSeasons is already set or the anime is a movie.
export async function autoFillSeasonCount(animeId: number): Promise<void> {
  const anime = await db.anime.findUnique({ where: { id: animeId } });
  if (!anime) return;
  if (anime.totalSeasons && anime.episodesPerSeason) return; // already set — don't overwrite
  if (anime.displayFormat === "MOVIE") return;

  let tmdbId = anime.tmdbId;

  // Find TMDB ID if we don't have it
  if (!tmdbId) {
    const searchTitle = anime.titleEnglish ?? anime.titleRomaji;
    const match = await findTmdbEntry(searchTitle, "tv", anime.seasonYear);
    if (!match) return;
    tmdbId = match.tmdbId;
    await db.anime.update({
      where: { id: animeId },
      data: { tmdbId: match.tmdbId, tmdbMediaType: "tv" },
    });
  }

  const details = await tmdbFetch<TmdbTvDetails>(`/tv/${tmdbId}`);
  const seasons = details?.number_of_seasons;
  if (seasons && seasons > 0) {
    const episodesPerSeason = (details?.seasons ?? [])
      .filter((s) => s.season_number > 0) // exclude specials (season 0)
      .sort((a, b) => a.season_number - b.season_number)
      .map((s) => s.episode_count);
    await db.anime.update({
      where: { id: animeId },
      data: { totalSeasons: seasons, episodesPerSeason: JSON.stringify(episodesPerSeason) },
    });
    console.log(`[tmdb] Auto-filled totalSeasons=${seasons} for anime ${animeId}`);
  }
}

// Force-refresh season count and per-season episode counts from TMDB, always overwriting.
export async function refreshSeasonData(animeId: number): Promise<void> {
  const anime = await db.anime.findUnique({ where: { id: animeId } });
  if (!anime || anime.displayFormat === "MOVIE") return;

  let tmdbId = anime.tmdbId;

  if (!tmdbId) {
    const searchTitle = anime.titleEnglish ?? anime.titleRomaji;
    const match = await findTmdbEntry(searchTitle, "tv", anime.seasonYear);
    if (!match) return;
    tmdbId = match.tmdbId;
    await db.anime.update({
      where: { id: animeId },
      data: { tmdbId: match.tmdbId, tmdbMediaType: "tv" },
    });
  }

  const details = await tmdbFetch<TmdbTvDetails>(`/tv/${tmdbId}`);
  if (!details) return;

  const seasons = details.number_of_seasons;
  const episodesPerSeason = (details.seasons ?? [])
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number)
    .map((s) => s.episode_count);

  await db.anime.update({
    where: { id: animeId },
    data: { totalSeasons: seasons, episodesPerSeason: JSON.stringify(episodesPerSeason) },
  });
  console.log(`[tmdb] Refreshed seasons=${seasons}, episodesPerSeason=${JSON.stringify(episodesPerSeason)} for anime ${animeId}`);
}

// ---------------------------------------------------------------------------
// Search TMDB for a title, return { tmdbId, mediaType } or null
// ---------------------------------------------------------------------------

export async function findTmdbEntry(
  title: string,
  mediaType: "tv" | "movie",
  seasonYear: number | null
): Promise<{ tmdbId: number; mediaType: "tv" | "movie" } | null> {
  const encoded = encodeURIComponent(title);
  const yearParam =
    seasonYear != null
      ? mediaType === "tv"
        ? `&first_air_date_year=${seasonYear}`
        : `&year=${seasonYear}`
      : "";

  const data = await tmdbFetch<TmdbSearchResponse>(
    `/search/${mediaType}?query=${encoded}&include_adult=false${yearParam}`
  );

  if (!data || data.results.length === 0) return null;

  return { tmdbId: data.results[0].id, mediaType };
}

// ---------------------------------------------------------------------------
// Fetch watch providers for a TMDB entry
// Returns map of StreamingService → homepage URL
// ---------------------------------------------------------------------------

async function getWatchProviders(
  tmdbId: number,
  mediaType: "tv" | "movie",
  searchTitle: string
): Promise<Map<StreamingService, string>> {
  const result = new Map<StreamingService, string>();

  const data = await tmdbFetch<TmdbWatchProvidersResponse>(
    `/${mediaType}/${tmdbId}/watch/providers`
  );

  if (!data) return result;

  const regionData = data.results[REGION];
  if (!regionData) return result;

  const encodedTitle = encodeURIComponent(searchTitle);

  // Only subscription/free/ad-supported — not rent/buy
  const allProviders = [
    ...(regionData.flatrate ?? []),
    ...(regionData.free ?? []),
    ...(regionData.ads ?? []),
  ];

  for (const provider of allProviders) {
    const service = PROVIDER_MAP[provider.provider_id];
    if (service && !result.has(service)) {
      const builder = SERVICE_SEARCH_URLS[service];
      if (builder) result.set(service, builder(encodedTitle));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Season episode details (episode names)
// ---------------------------------------------------------------------------

interface TmdbSeasonDetails {
  episodes: Array<{
    episode_number: number;
    name: string;
  }>;
}

export async function fetchSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number,
  animeId?: number
): Promise<Array<{ number: number; name: string }>> {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) return [];

  const url = `${TMDB_BASE}/tv/${tmdbId}/season/${seasonNumber}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[tmdb] ${res.status} ${res.statusText} for ${url}`);

      // Self-correct stale totalSeasons when TMDB says the season doesn't exist
      if (res.status === 404 && animeId && seasonNumber > 1) {
        const anime = await db.anime.findUnique({
          where: { id: animeId },
          select: { totalSeasons: true, episodesPerSeason: true },
        });
        if (anime?.totalSeasons && anime.totalSeasons >= seasonNumber) {
          const corrected = seasonNumber - 1;
          const eps: number[] | null = anime.episodesPerSeason
            ? JSON.parse(anime.episodesPerSeason)
            : null;
          await db.anime.update({
            where: { id: animeId },
            data: {
              totalSeasons: corrected,
              episodesPerSeason: eps ? JSON.stringify(eps.slice(0, corrected)) : null,
            },
          });
          console.log(`[tmdb] Self-corrected totalSeasons=${corrected} for anime ${animeId} (season ${seasonNumber} returned 404)`);
        }
      }

      return [];
    }

    const data = (await res.json()) as TmdbSeasonDetails;
    return data.episodes.map((ep) => ({ number: ep.episode_number, name: ep.name }));
  } catch (err) {
    console.warn(`[tmdb] Network error fetching ${url}:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Offset-based episode fetch — for multi-link anime where virtual season ≠ TMDB season
// ---------------------------------------------------------------------------

// Given a 0-based episode offset (total eps before the virtual season) and count,
// walks TMDB season structures to find the right season and slice.
export async function fetchEpisodesAtOffset(
  tmdbId: number,
  episodeOffset: number,
  episodeCount: number,
): Promise<Array<{ number: number; name: string }>> {
  if (!process.env.TMDB_API_TOKEN) return [];

  const details = await tmdbFetch<TmdbTvDetails>(`/tv/${tmdbId}`);
  if (!details) return [];

  const tmdbSeasons = (details.seasons ?? [])
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);

  let cumulative = 0;
  for (const tmdbSeason of tmdbSeasons) {
    const seasonStart = cumulative;
    const seasonEnd = cumulative + tmdbSeason.episode_count;

    // Does this TMDB season contain the start of our episode range?
    if (seasonEnd > episodeOffset && seasonStart <= episodeOffset) {
      const episodes = await fetchSeasonEpisodes(tmdbId, tmdbSeason.season_number);
      if (episodes.length === 0) return [];

      const withinOffset = episodeOffset - seasonStart; // 0-based skip within this season
      return episodes
        .filter((e) => e.number > withinOffset && e.number <= withinOffset + episodeCount)
        .map((e) => ({ number: e.number - withinOffset, name: e.name }));
    }

    cumulative = seasonEnd;
  }

  return [];
}

// ---------------------------------------------------------------------------
// Main orchestration — called from API routes
// ---------------------------------------------------------------------------

export async function refreshStreamingForAnime(animeId: number): Promise<void> {
  const anime = await db.anime.findUnique({ where: { id: animeId } });
  if (!anime) return;

  const mediaType: "tv" | "movie" =
    anime.displayFormat === "MOVIE" ? "movie" : "tv";

  let tmdbId = anime.tmdbId ?? null;
  let resolvedMediaType = (anime.tmdbMediaType as "tv" | "movie" | null) ?? mediaType;
  const searchTitle = anime.titleEnglish ?? anime.titleRomaji;

  // Resolve TMDB ID if we don't have it yet
  if (!tmdbId) {
    console.log(`[tmdb] Searching for "${searchTitle}" (${mediaType})`);

    const match = await findTmdbEntry(searchTitle, mediaType, anime.seasonYear);

    if (!match) {
      console.log(`[tmdb] No TMDB match found for "${searchTitle}" — stamping timestamp`);
      await db.anime.update({
        where: { id: animeId },
        data: { streamingCheckedAt: new Date() },
      });
      return;
    }

    tmdbId = match.tmdbId;
    resolvedMediaType = match.mediaType;
    console.log(`[tmdb] Matched to TMDB ${match.mediaType}/${match.tmdbId}`);

    await db.anime.update({
      where: { id: animeId },
      data: {
        tmdbId: match.tmdbId,
        tmdbMediaType: match.mediaType,
      },
    });
  }

  // Auto-fill totalSeasons + episodesPerSeason for TV shows while we have the TMDB ID handy
  if (resolvedMediaType === "tv" && (!anime.totalSeasons || !anime.episodesPerSeason)) {
    const details = await tmdbFetch<TmdbTvDetails>(`/tv/${tmdbId}`);
    const seasons = details?.number_of_seasons;
    if (seasons && seasons > 0) {
      const episodesPerSeason = (details?.seasons ?? [])
        .filter((s) => s.season_number > 0)
        .sort((a, b) => a.season_number - b.season_number)
        .map((s) => s.episode_count);
      await db.anime.update({
        where: { id: animeId },
        data: { totalSeasons: seasons, episodesPerSeason: JSON.stringify(episodesPerSeason) },
      });
      console.log(`[tmdb] Auto-filled totalSeasons=${seasons} for anime ${animeId}`);
    }
  }

  // Fetch streaming providers
  const providers = await getWatchProviders(tmdbId, resolvedMediaType, searchTitle);
  console.log(
    `[tmdb] Found ${providers.size} provider(s) for anime ${animeId}: ${[...providers.keys()].join(", ") || "none"}`
  );

  // Upsert a StreamingLink for each discovered provider
  for (const [service, url] of providers) {
    await db.streamingLink.upsert({
      where: { animeId_service: { animeId, service } },
      update: { url },
      create: { animeId, service, url },
    });
  }

  // Always stamp the check timestamp
  await db.anime.update({
    where: { id: animeId },
    data: { streamingCheckedAt: new Date() },
  });
}
