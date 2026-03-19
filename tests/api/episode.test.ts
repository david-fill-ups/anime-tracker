import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mock definitions before any imports so vi.mock factories can
// reference them. Pattern mirrors tests/lib/franchise-auto-integration.test.ts.
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  link: {
    findFirst: vi.fn(),
  },
  userEntry: {
    update: vi.fn(),
  },
}));

const mockRequireUserId = vi.hoisted(() => vi.fn<() => Promise<string>>());

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth-helpers", () => ({ requireUserId: mockRequireUserId }));

// ---------------------------------------------------------------------------
// Import the route handler AFTER mocks are registered.
// ---------------------------------------------------------------------------

import { PATCH } from "@/app/api/anime/[id]/episode/route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal NextRequest for the PATCH endpoint. */
function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/anime/1/episode", { method: "PATCH" });
}

/** Build route params as the App Router passes them. */
function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

/** A minimal link returned by db.link.findFirst with a single linked anime. */
function makeLinkFixture(overrides: {
  currentEpisode?: number;
  totalEpisodes?: number | null;
  airingStatus?: string;
  startedAt?: Date | null;
} = {}) {
  const {
    currentEpisode = 5,
    totalEpisodes = 24,
    airingStatus = "RELEASING",
    startedAt = new Date("2024-01-01"),
  } = overrides;

  return {
    id: 1,
    userEntry: {
      id: 10,
      linkId: 1,
      currentEpisode,
      watchStatus: "WATCHING",
      startedAt,
      completedAt: null,
    },
    linkedAnime: [
      {
        anime: {
          totalEpisodes,
          airingStatus,
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated as "user-1"
  mockRequireUserId.mockResolvedValue("user-1");
});

// ---------------------------------------------------------------------------

describe("PATCH /api/anime/[id]/episode", () => {
  it("basic increment: currentEpisode advances from 5 to 6", async () => {
    const link = makeLinkFixture({ currentEpisode: 5, totalEpisodes: 24 });
    mockDb.link.findFirst.mockResolvedValue(link);
    mockDb.userEntry.update.mockResolvedValue({ ...link.userEntry, currentEpisode: 6 });

    const response = await PATCH(makeRequest(), makeParams("1"));

    expect(response.status).toBe(200);
    expect(mockDb.userEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentEpisode: 6 }),
      })
    );
  });

  it("auto-complete: sets watchStatus=COMPLETED when newEpisode >= totalEpisodes", async () => {
    // currentEpisode=11, totalEpisodes=12 → newEpisode=12 >= 12 → COMPLETED
    const link = makeLinkFixture({ currentEpisode: 11, totalEpisodes: 12, airingStatus: "FINISHED" });
    mockDb.link.findFirst.mockResolvedValue(link);
    mockDb.userEntry.update.mockResolvedValue({
      ...link.userEntry,
      currentEpisode: 12,
      watchStatus: "COMPLETED",
    });

    const response = await PATCH(makeRequest(), makeParams("1"));

    expect(response.status).toBe(200);
    expect(mockDb.userEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentEpisode: 12,
          watchStatus: "COMPLETED",
          completedAt: expect.any(Date),
        }),
      })
    );
  });

  it("no auto-complete: when totalEpisodes is null, only increments episode", async () => {
    // totalEpisodes=null → effectiveTotalEpisodesFromLink returns null → no COMPLETED
    const link = makeLinkFixture({ currentEpisode: 5, totalEpisodes: null });
    mockDb.link.findFirst.mockResolvedValue(link);
    mockDb.userEntry.update.mockResolvedValue({ ...link.userEntry, currentEpisode: 6 });

    const response = await PATCH(makeRequest(), makeParams("1"));

    expect(response.status).toBe(200);
    const updateCall = mockDb.userEntry.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("watchStatus", "COMPLETED");
    expect(updateCall.data).not.toHaveProperty("completedAt");
    expect(updateCall.data.currentEpisode).toBe(6);
  });

  it("auth check: returns 401 when requireUserId throws an Unauthorized Response", async () => {
    mockRequireUserId.mockRejectedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await PATCH(makeRequest(), makeParams("1"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
    // DB must not be touched when auth fails
    expect(mockDb.link.findFirst).not.toHaveBeenCalled();
  });

  it("invalid anime ID: returns 400 for a non-numeric id", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/anime/abc/episode", { method: "PATCH" }),
      makeParams("abc")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid id");
  });

  it("returns 404 when no matching link exists for the user", async () => {
    mockDb.link.findFirst.mockResolvedValue(null);

    const response = await PATCH(makeRequest(), makeParams("999"));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Not found");
  });
});
