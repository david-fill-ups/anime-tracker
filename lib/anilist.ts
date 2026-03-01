import { GraphQLClient, gql } from "graphql-request";

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
