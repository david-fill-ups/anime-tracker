import { describe, it, expect, vi } from "vitest";

// Mock db so the module can be imported without a real DB connection
vi.mock("@/lib/db", () => ({ db: {} }));

import {
  mapDisplayFormat,
  mapSourceMaterial,
  mapAniListToAnimeData,
} from "@/lib/anilist";
import type { AniListAnime } from "@/lib/anilist";

const base: AniListAnime = {
  id: 1,
  title: { romaji: "Test Anime", english: "Test Anime EN", native: "テスト" },
  coverImage: { large: "https://example.com/cover.jpg" },
  description: "A test anime",
  genres: ["Action", "Adventure"],
  episodes: 12,
  duration: 24,
  status: "FINISHED",
  format: "TV",
  source: "MANGA",
  season: "SPRING",
  seasonYear: 2023,
  meanScore: 80,
  nextAiringEpisode: null,
  studios: { edges: [] },
  relations: { edges: [] },
};

describe("mapDisplayFormat", () => {
  it("maps MOVIE to MOVIE", () => {
    expect(mapDisplayFormat("MOVIE")).toBe("MOVIE");
  });

  it.each(["TV", "TV_SHORT", "OVA", "ONA", "SPECIAL", "MUSIC"] as const)(
    "maps %s to SERIES",
    (format) => {
      expect(mapDisplayFormat(format)).toBe("SERIES");
    }
  );
});

describe("mapSourceMaterial", () => {
  it("returns null for null input", () => {
    expect(mapSourceMaterial(null)).toBeNull();
  });

  it.each([
    ["MANGA", "MANGA"],
    ["LIGHT_NOVEL", "LIGHT_NOVEL"],
    ["NOVEL", "NOVEL"],
    ["VISUAL_NOVEL", "VISUAL_NOVEL"],
    ["VIDEO_GAME", "VIDEO_GAME"],
    ["ORIGINAL", "ORIGINAL"],
  ] as const)("maps %s to %s", (input, expected) => {
    expect(mapSourceMaterial(input)).toBe(expected);
  });

  it("maps unknown source to OTHER", () => {
    expect(mapSourceMaterial("OTHER")).toBe("OTHER");
  });
});

describe("mapAniListToAnimeData", () => {
  it("maps all basic fields correctly", () => {
    const result = mapAniListToAnimeData(base);
    expect(result.anilistId).toBe(1);
    expect(result.source).toBe("ANILIST");
    expect(result.titleRomaji).toBe("Test Anime");
    expect(result.titleEnglish).toBe("Test Anime EN");
    expect(result.titleNative).toBe("テスト");
    expect(result.coverImageUrl).toBe("https://example.com/cover.jpg");
    expect(result.synopsis).toBe("A test anime");
    expect(result.genres).toBe(JSON.stringify(["Action", "Adventure"]));
    expect(result.totalEpisodes).toBe(12);
    expect(result.durationMins).toBe(24);
    expect(result.airingStatus).toBe("FINISHED");
    expect(result.displayFormat).toBe("SERIES");
    expect(result.sourceMaterial).toBe("MANGA");
    expect(result.season).toBe("SPRING");
    expect(result.seasonYear).toBe(2023);
    expect(result.meanScore).toBe(80);
    expect(result.nextAiringEp).toBeNull();
    expect(result.nextAiringAt).toBeNull();
    expect(result.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("maps null optional fields to null", () => {
    const result = mapAniListToAnimeData({
      ...base,
      title: { romaji: "Test", english: null, native: null },
      description: null,
      episodes: null,
      duration: null,
      source: null,
      season: null,
      seasonYear: null,
      meanScore: null,
    });
    expect(result.titleEnglish).toBeNull();
    expect(result.titleNative).toBeNull();
    expect(result.synopsis).toBeNull();
    expect(result.totalEpisodes).toBeNull();
    expect(result.durationMins).toBeNull();
    expect(result.sourceMaterial).toBeNull();
    expect(result.season).toBeNull();
    expect(result.seasonYear).toBeNull();
    expect(result.meanScore).toBeNull();
  });

  it("maps nextAiringEpisode to Date and episode number", () => {
    const airingAt = 1700000000; // unix timestamp
    const result = mapAniListToAnimeData({
      ...base,
      nextAiringEpisode: { episode: 5, airingAt },
    });
    expect(result.nextAiringEp).toBe(5);
    expect(result.nextAiringAt).toEqual(new Date(airingAt * 1000));
  });

  it("includes tmdbId when provided via extra", () => {
    const result = mapAniListToAnimeData(base, { tmdbId: 42 });
    expect((result as Record<string, unknown>).tmdbId).toBe(42);
  });

  it("omits tmdbId when extra.tmdbId is null", () => {
    const result = mapAniListToAnimeData(base, { tmdbId: null });
    expect("tmdbId" in result).toBe(false);
  });

  it("omits tmdbId when no extra argument provided", () => {
    const result = mapAniListToAnimeData(base);
    expect("tmdbId" in result).toBe(false);
  });

  it("maps MOVIE format to MOVIE displayFormat", () => {
    const result = mapAniListToAnimeData({ ...base, format: "MOVIE" });
    expect(result.displayFormat).toBe("MOVIE");
  });
});
