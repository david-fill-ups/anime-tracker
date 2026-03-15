import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted — use vi.hoisted() to define variables used in the factory
const mockDb = vi.hoisted(() => ({
  anime: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  franchise: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  franchiseEntry: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/anilist", () => ({
  fetchAniListById: vi.fn(),
  mapAniListToAnimeData: vi.fn((data: { id: number }) => ({ anilistId: data.id })),
}));

import { autoPopulateFranchise } from "@/lib/franchise-auto";
import type { AniListAnime } from "@/lib/anilist";

const baseAnime: AniListAnime = {
  id: 1,
  title: { romaji: "Test Anime", english: "Test Anime EN", native: null },
  coverImage: { large: null },
  description: null,
  genres: [],
  episodes: 12,
  duration: 24,
  status: "FINISHED",
  format: "TV",
  source: null,
  season: "SPRING",
  seasonYear: 2022,
  meanScore: null,
  nextAiringEpisode: null,
  studios: { edges: [] },
  relations: { edges: [] },
};

const withSequel: AniListAnime = {
  ...baseAnime,
  relations: {
    edges: [
      { relationType: "SEQUEL", node: { id: 2, type: "ANIME" } },
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible defaults — override per test
  mockDb.anime.findMany.mockResolvedValue([]);
  mockDb.franchise.create.mockResolvedValue({ id: 42, name: "Test Anime EN", userId: "u1" });
  mockDb.franchise.update.mockResolvedValue({});
  mockDb.franchise.delete.mockResolvedValue({});
  mockDb.franchiseEntry.findMany.mockResolvedValue([]);
  mockDb.franchiseEntry.findFirst.mockResolvedValue(null);
  mockDb.franchiseEntry.create.mockResolvedValue({ id: 99 });
  mockDb.franchiseEntry.upsert.mockResolvedValue({ id: 99 });
});

describe("autoPopulateFranchise", () => {
  it("does nothing when anime has no franchise-relevant relations", async () => {
    await autoPopulateFranchise(1, baseAnime, "u1");
    expect(mockDb.anime.findMany).not.toHaveBeenCalled();
    expect(mockDb.franchise.create).not.toHaveBeenCalled();
  });

  it("does nothing when related anime are not in the DB", async () => {
    mockDb.anime.findMany.mockResolvedValueOnce([]); // no related in DB
    await autoPopulateFranchise(1, withSequel, "u1");
    expect(mockDb.franchise.create).not.toHaveBeenCalled();
  });

  it("creates a new franchise when a related anime is in DB but no franchise exists", async () => {
    const relatedAnime = { id: 10, anilistId: 2, seasonYear: 2021, season: "WINTER", displayFormat: "SERIES" };
    mockDb.anime.findMany.mockResolvedValueOnce([relatedAnime]); // relatedInDb

    // existingEntries → no franchise yet
    mockDb.franchiseEntry.findMany
      .mockResolvedValueOnce([]) // existingEntries
      .mockResolvedValueOnce([]) // findAvailableOrder for relatedAnime
      .mockResolvedValueOnce([]) // findAvailableOrder for current anime
      .mockResolvedValueOnce([{ anime: { titleEnglish: "Test Anime EN", titleRomaji: "Test Anime" } }]); // renameFranchiseToEarliest

    await autoPopulateFranchise(1, withSequel, "u1");

    expect(mockDb.franchise.create).toHaveBeenCalledWith({
      data: { name: "Test Anime EN", userId: "u1" },
    });
    // Related anime and current anime both added
    expect(mockDb.franchiseEntry.create).toHaveBeenCalledTimes(2);
    // Franchise renamed to earliest entry's title
    expect(mockDb.franchise.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { name: "Test Anime EN" },
    });
  });

  it("uses the existing franchise when one already exists for a related anime", async () => {
    const relatedAnime = { id: 10, anilistId: 2, seasonYear: 2021, season: "WINTER", displayFormat: "SERIES" };
    mockDb.anime.findMany.mockResolvedValueOnce([relatedAnime]);

    // existingEntries → one franchise already contains relatedAnime
    mockDb.franchiseEntry.findMany
      .mockResolvedValueOnce([{ franchiseId: 5, animeId: 10 }]) // existingEntries
      .mockResolvedValueOnce([]) // findAvailableOrder for current anime (relatedAnime already in franchise)
      .mockResolvedValueOnce([{ anime: { titleEnglish: null, titleRomaji: "Test Anime" } }]); // renameFranchiseToEarliest

    await autoPopulateFranchise(1, withSequel, "u1");

    // Should NOT create a new franchise
    expect(mockDb.franchise.create).not.toHaveBeenCalled();
    // Should add current anime (animeId=1) to the existing franchise
    expect(mockDb.franchiseEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ franchiseId: 5, animeId: 1 }) })
    );
  });

  it("scopes franchise lookup to the current user (ownership enforcement)", async () => {
    const relatedAnime = { id: 10, anilistId: 2, seasonYear: 2021, season: "WINTER", displayFormat: "SERIES" };
    mockDb.anime.findMany.mockResolvedValueOnce([relatedAnime]);
    mockDb.franchiseEntry.findMany.mockResolvedValue([]);

    await autoPopulateFranchise(1, withSequel, "my-user-id");

    // existingEntries query must filter by userId to avoid cross-user leakage
    const existingEntriesCall = mockDb.franchiseEntry.findMany.mock.calls[0][0];
    expect(existingEntriesCall.where.franchise).toEqual({ userId: "my-user-id" });
  });

  it("merges two franchises into the one with the lower ID", async () => {
    const relatedAnime = { id: 10, anilistId: 2, seasonYear: 2021, season: "WINTER", displayFormat: "SERIES" };
    mockDb.anime.findMany.mockResolvedValueOnce([relatedAnime]);

    // existingEntries → two different franchises
    mockDb.franchiseEntry.findMany
      .mockResolvedValueOnce([
        { franchiseId: 3, animeId: 1 },
        { franchiseId: 7, animeId: 10 },
      ]) // existingEntries
      .mockResolvedValueOnce([{ id: 99, animeId: 10, entryType: "MAIN", anime: { seasonYear: 2021, season: "WINTER" } }]) // srcEntries from franchise 7
      .mockResolvedValueOnce([]) // findFirst inside merge loop (alreadyInTarget)
      .mockResolvedValueOnce([]) // findAvailableOrder for merge
      .mockResolvedValueOnce([]) // findAvailableOrder for current anime (already in franchise 3)
      .mockResolvedValueOnce([{ anime: { titleEnglish: null, titleRomaji: "Test Anime" } }]); // renameFranchiseToEarliest

    mockDb.franchiseEntry.findFirst
      .mockResolvedValueOnce({ franchiseId: 3, animeId: 1 }); // current anime alreadyInFranchise

    await autoPopulateFranchise(1, withSequel, "u1");

    // Lower ID franchise (3) survives; higher ID (7) is deleted
    expect(mockDb.franchise.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(mockDb.franchise.delete).not.toHaveBeenCalledWith({ where: { id: 3 } });
  });
});
