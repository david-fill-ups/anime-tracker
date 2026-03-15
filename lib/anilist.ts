import { GraphQLClient, gql } from "graphql-request";
import { db } from "./db";
import type { StreamingService } from "@/app/generated/prisma";

const client = new GraphQLClient("https://graphql.anilist.co");

export interface AniListAnime {
  id: number;
  title: {
    romaji: string;
    english: string | null;
    native: string | null;
  };
  coverImage: {
    large: string;
  };
  description: string | null;
  genres: string[];
  episodes: number | null;
  duration: number | null;
  status: "FINISHED" | "RELEASING" | "NOT_YET_RELEASED" | "CANCELLED" | "HIATUS";
  format: "TV" | "TV_SHORT" | "MOVIE" | "SPECIAL" | "OVA" | "ONA" | "MUSIC";
  source:
    | "ORIGINAL"
    | "MANGA"
    | "LIGHT_NOVEL"
    | "VISUAL_NOVEL"
    | "VIDEO_GAME"
    | "OTHER"
    | "NOVEL"
    | null;
  season: "WINTER" | "SPRING" | "SUMMER" | "FALL" | null;
  seasonYear: number | null;
  meanScore: number | null;
  startDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  } | null;
  nextAiringEpisode: {
    episode: number;
    airingAt: number; // unix timestamp
  } | null;
  studios: {
    edges: {
      isMain: boolean;
      node: {
        id: number;
        name: string;
      };
    }[];
  };
  relations: {
    edges: {
      relationType: string;
      node: {
        id: number;
        type: string;
        title: { romaji: string; english: string | null };
      };
    }[];
  };
}

const ANIME_FIELDS = gql`
  fragment AnimeFields on Media {
    id
    title {
      romaji
      english
      native
    }
    coverImage {
      large
    }
    description(asHtml: false)
    genres
    episodes
    duration
    status
    format
    source
    season
    seasonYear
    meanScore
    startDate {
      year
      month
      day
    }
    nextAiringEpisode {
      episode
      airingAt
    }
    studios {
      edges {
        isMain
        node {
          id
          name
        }
      }
    }
    relations {
      edges {
        relationType(version: 2)
        node {
          id
          type
          title {
            romaji
            english
          }
        }
      }
    }
  }
`;

const SEARCH_QUERY = gql`
  ${ANIME_FIELDS}
  query SearchAnime($search: String!, $page: Int) {
    Page(page: $page, perPage: 10) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        ...AnimeFields
      }
    }
  }
`;

const FETCH_BY_ID_QUERY = gql`
  ${ANIME_FIELDS}
  query FetchAnime($id: Int!) {
    Media(id: $id, type: ANIME) {
      ...AnimeFields
    }
  }
`;

export async function searchAniList(
  search: string,
  page = 1
): Promise<AniListAnime[]> {
  try {
    const data = await client.request<{
      Page: { media: AniListAnime[] };
    }>(SEARCH_QUERY, { search, page });
    return data.Page.media;
  } catch {
    return [];
  }
}

export async function fetchAniListById(id: number): Promise<AniListAnime | null> {
  try {
    const data = await client.request<{ Media: AniListAnime }>(
      FETCH_BY_ID_QUERY,
      { id }
    );
    return data.Media;
  } catch {
    return null;
  }
}

// Map AniList format to our DisplayFormat
export function mapDisplayFormat(
  format: AniListAnime["format"]
): "SERIES" | "MOVIE" {
  return format === "MOVIE" ? "MOVIE" : "SERIES";
}

// Map an AniListAnime to Prisma Anime create/update data fields.
// Pass extra fields (e.g. tmdbId) via the second argument.
export function mapAniListToAnimeData(
  data: AniListAnime,
  extra?: { tmdbId?: number | null }
) {
  return {
    anilistId: data.id,
    source: "ANILIST" as const,
    titleRomaji: data.title.romaji,
    titleEnglish: data.title.english ?? null,
    titleNative: data.title.native ?? null,
    coverImageUrl: data.coverImage.large,
    synopsis: data.description ?? null,
    genres: JSON.stringify(data.genres),
    totalEpisodes: data.episodes ?? null,
    durationMins: data.duration ?? null,
    airingStatus: data.status,
    displayFormat: mapDisplayFormat(data.format),
    sourceMaterial: mapSourceMaterial(data.source),
    season: data.season ?? null,
    seasonYear: data.seasonYear ?? null,
    meanScore: data.meanScore ?? null,
    startYear: data.startDate?.year ?? null,
    startMonth: data.startDate?.month ?? null,
    startDay: data.startDate?.day ?? null,
    nextAiringEp: data.nextAiringEpisode?.episode ?? null,
    nextAiringAt: data.nextAiringEpisode
      ? new Date(data.nextAiringEpisode.airingAt * 1000)
      : null,
    lastSyncedAt: new Date(),
    ...(extra?.tmdbId != null ? { tmdbId: extra.tmdbId } : {}),
  };
}

// Upsert AniList studio edges and return Prisma AnimeStudio create data.
export async function upsertStudios(
  edges: { isMain: boolean; node: { id: number; name: string } }[]
): Promise<{ studioId: number; isMainStudio: boolean }[]> {
  const creates: { studioId: number; isMainStudio: boolean }[] = [];
  for (const edge of edges) {
    const studio = await db.studio.upsert({
      where: { anilistStudioId: edge.node.id },
      update: { name: edge.node.name },
      create: { name: edge.node.name, anilistStudioId: edge.node.id },
    });
    creates.push({ studioId: studio.id, isMainStudio: edge.isMain });
  }
  // Deduplicate by studioId in case AniList returns the same studio multiple times
  const seen = new Set<number>();
  return creates.filter((c) => {
    if (seen.has(c.studioId)) return false;
    seen.add(c.studioId);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Streaming links from AniList externalLinks
// ---------------------------------------------------------------------------

const ANILIST_SITE_MAP: Record<string, StreamingService> = {
  "Crunchyroll":          "CRUNCHYROLL",
  "Netflix":              "NETFLIX",
  "Hulu":                 "HULU",
  "Disney Plus":          "DISNEY_PLUS",
  "Amazon Prime Video":   "AMAZON_PRIME",
  "HIDIVE":               "HIDIVE",
  "HBO Max":              "HBO",
  "Max":                  "HBO",
};

const STREAMING_LINKS_QUERY = gql`
  query FetchStreamingLinks($id: Int!) {
    Media(id: $id, type: ANIME) {
      externalLinks {
        url
        site
        type
      }
    }
  }
`;

export async function fetchAniListStreamingLinks(
  anilistId: number
): Promise<Map<StreamingService, string>> {
  const result = new Map<StreamingService, string>();
  try {
    const data = await client.request<{
      Media: { externalLinks: { url: string; site: string; type: string }[] };
    }>(STREAMING_LINKS_QUERY, { id: anilistId });

    for (const link of data.Media.externalLinks) {
      const service = ANILIST_SITE_MAP[link.site];
      if (service && !result.has(service)) {
        result.set(service, link.url);
      }
    }
  } catch {
    // AniList failures are non-fatal
  }
  return result;
}

// Map AniList source to our SourceMaterial
export function mapSourceMaterial(
  source: AniListAnime["source"]
): "ORIGINAL" | "MANGA" | "LIGHT_NOVEL" | "NOVEL" | "VISUAL_NOVEL" | "VIDEO_GAME" | "OTHER" | null {
  if (!source) return null;
  const map: Record<string, "ORIGINAL" | "MANGA" | "LIGHT_NOVEL" | "NOVEL" | "VISUAL_NOVEL" | "VIDEO_GAME" | "OTHER"> = {
    ORIGINAL: "ORIGINAL",
    MANGA: "MANGA",
    LIGHT_NOVEL: "LIGHT_NOVEL",
    NOVEL: "NOVEL",
    VISUAL_NOVEL: "VISUAL_NOVEL",
    VIDEO_GAME: "VIDEO_GAME",
  };
  return map[source] ?? "OTHER";
}
