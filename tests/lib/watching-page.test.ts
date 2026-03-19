import { describe, it, expect, vi, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Inline helper: mirrors the episode-behind calculation in app/watching/page.tsx
// lines 91–114. If the page logic changes, update this helper to match.
// ---------------------------------------------------------------------------

type ShowForCalc = {
  airingStatus: "FINISHED" | "RELEASING" | "CANCELLED" | "HIATUS" | "NOT_YET_RELEASED";
  totalEpisodes: number | null;
  nextAiringEp: number | null;
  nextAiringAt: Date | null;
};

function calcBehind(
  shows: ShowForCalc[],
  currentEpisode: number
): { episodesAired: number | null; behind: number | null } {
  let episodesAired: number | null = null;
  let nextAt: Date | null = null; // eslint-disable-line @typescript-eslint/no-unused-vars

  for (const show of shows) {
    if (show.airingStatus === "FINISHED" || show.airingStatus === "CANCELLED") {
      if (show.totalEpisodes != null) episodesAired = (episodesAired ?? 0) + show.totalEpisodes;
    } else if (show.airingStatus === "RELEASING") {
      if (show.nextAiringEp != null) {
        const showNextAt = show.nextAiringAt ? new Date(show.nextAiringAt) : null;
        const isPast = showNextAt ? showNextAt.getTime() < Date.now() : false;
        episodesAired = (episodesAired ?? 0) + (isPast ? show.nextAiringEp : show.nextAiringEp - 1);
        if (!nextAt && showNextAt && !isPast) nextAt = showNextAt;
      } else {
        // nextAiringEp is null: can't determine how many episodes have aired.
        // Mark as unknown so the entry appears in Catch Up rather than Keep Up.
        episodesAired = null;
        break;
      }
    }
    // NOT_YET_RELEASED: 0 episodes aired, skip
  }

  const behind = episodesAired != null ? Math.max(0, episodesAired - currentEpisode) : null;
  return { episodesAired, behind };
}

// ---------------------------------------------------------------------------
// Categorisation helpers (mirrors the filter logic in the page)
// ---------------------------------------------------------------------------

function categorizeBehind(
  behind: number | null,
  isReleasing: boolean
): "catchUp" | "keepUp" | "neither" {
  if (behind == null || behind > 0) return "catchUp";
  if (behind === 0 && isReleasing) return "keepUp";
  return "neither";
}

// ---------------------------------------------------------------------------

afterEach(() => {
  vi.useRealTimers();
});

describe("calcBehind — episode-behind calculation (mirrors app/watching/page.tsx)", () => {
  it("FINISHED show: episodesAired equals totalEpisodes", () => {
    const shows: ShowForCalc[] = [
      { airingStatus: "FINISHED", totalEpisodes: 12, nextAiringEp: null, nextAiringAt: null },
    ];
    const { episodesAired, behind } = calcBehind(shows, 8);
    expect(episodesAired).toBe(12);
    expect(behind).toBe(4);
  });

  it("RELEASING show with future nextAiringAt: counts nextAiringEp - 1 as aired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00Z"));

    const futureDate = new Date("2025-06-08T00:00:00Z"); // 1 week in the future
    const shows: ShowForCalc[] = [
      {
        airingStatus: "RELEASING",
        totalEpisodes: null,
        nextAiringEp: 5,
        nextAiringAt: futureDate,
      },
    ];
    const { episodesAired, behind } = calcBehind(shows, 3);
    expect(episodesAired).toBe(4); // ep 5 hasn't aired yet → 5 - 1 = 4
    expect(behind).toBe(1);
  });

  it("RELEASING show with past nextAiringAt: counts nextAiringEp itself as aired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T00:00:00Z"));

    const pastDate = new Date("2025-06-08T00:00:00Z"); // 1 week in the past
    const shows: ShowForCalc[] = [
      {
        airingStatus: "RELEASING",
        totalEpisodes: null,
        nextAiringEp: 5,
        nextAiringAt: pastDate,
      },
    ];
    const { episodesAired, behind } = calcBehind(shows, 3);
    expect(episodesAired).toBe(5); // ep 5 has already aired → counts as 5
    expect(behind).toBe(2);
  });

  // Regression test: Oshi no Ko Season 3 (and similar shows) were incorrectly
  // appearing in "Keep Up" instead of "Catch Up" because nextAiringEp was null
  // during mid-cour break / between seasons. When nextAiringEp is null we cannot
  // determine how many episodes have aired, so episodesAired must be null and the
  // show must be treated as unknown (→ Catch Up), not as "caught up" (→ Keep Up).
  it("RELEASING show with null nextAiringEp: episodesAired=null, behind=null (Oshi no Ko S3 regression)", () => {
    const shows: ShowForCalc[] = [
      {
        airingStatus: "RELEASING",
        totalEpisodes: null,
        nextAiringEp: null, // AniList hasn't populated next episode data yet
        nextAiringAt: null,
      },
    ];
    const { episodesAired, behind } = calcBehind(shows, 0);
    expect(episodesAired).toBe(null);
    expect(behind).toBe(null);
  });

  it("NOT_YET_RELEASED show: contributes 0 episodes aired (loop continues)", () => {
    const shows: ShowForCalc[] = [
      { airingStatus: "NOT_YET_RELEASED", totalEpisodes: 12, nextAiringEp: null, nextAiringAt: null },
    ];
    // episodesAired starts as null and is never incremented because the status is skipped
    const { episodesAired, behind } = calcBehind(shows, 0);
    expect(episodesAired).toBe(null);
    expect(behind).toBe(null);
  });

  it("multi-season chain (FINISHED + FINISHED + RELEASING future): sums all seasons", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-10-01T00:00:00Z"));

    const futureDate = new Date("2025-10-08T00:00:00Z");
    const shows: ShowForCalc[] = [
      // S1 — complete
      { airingStatus: "FINISHED", totalEpisodes: 11, nextAiringEp: null, nextAiringAt: null },
      // S2 — complete
      { airingStatus: "FINISHED", totalEpisodes: 13, nextAiringEp: null, nextAiringAt: null },
      // S3 — currently releasing, ep 3 airs next week
      {
        airingStatus: "RELEASING",
        totalEpisodes: null,
        nextAiringEp: 3,
        nextAiringAt: futureDate,
      },
    ];
    // S1(11) + S2(13) + S3(3-1=2) = 26 aired
    const { episodesAired, behind } = calcBehind(shows, 24);
    expect(episodesAired).toBe(26);
    expect(behind).toBe(2);
  });

  it("multi-season with null nextAiringEp mid-chain: breaks loop → episodesAired=null", () => {
    const shows: ShowForCalc[] = [
      { airingStatus: "FINISHED", totalEpisodes: 11, nextAiringEp: null, nextAiringAt: null },
      {
        airingStatus: "RELEASING",
        totalEpisodes: null,
        nextAiringEp: null, // unknown — breaks the chain
        nextAiringAt: null,
      },
    ];
    const { episodesAired, behind } = calcBehind(shows, 5);
    expect(episodesAired).toBe(null);
    expect(behind).toBe(null);
  });

  it("behind never goes negative: when user is ahead of aired count, behind=0", () => {
    const shows: ShowForCalc[] = [
      { airingStatus: "FINISHED", totalEpisodes: 5, nextAiringEp: null, nextAiringAt: null },
    ];
    // User is on ep 10 but only 5 have aired (e.g. data not yet updated)
    const { episodesAired, behind } = calcBehind(shows, 10);
    expect(episodesAired).toBe(5);
    expect(behind).toBe(0);
  });

  it("CANCELLED show is treated the same as FINISHED: totalEpisodes counted", () => {
    const shows: ShowForCalc[] = [
      { airingStatus: "CANCELLED", totalEpisodes: 6, nextAiringEp: null, nextAiringAt: null },
    ];
    const { episodesAired, behind } = calcBehind(shows, 3);
    expect(episodesAired).toBe(6);
    expect(behind).toBe(3);
  });
});

describe("categorization — behind=null goes to Catch Up, behind=0 + releasing goes to Keep Up", () => {
  it("behind=null → Catch Up (not Keep Up)", () => {
    // This is the key invariant: unknown progress must never be treated as
    // "caught up". Violating this was the Oshi no Ko S3 bug.
    expect(categorizeBehind(null, true)).toBe("catchUp");
    expect(categorizeBehind(null, false)).toBe("catchUp");
  });

  it("behind=0 and isReleasing=true → Keep Up", () => {
    expect(categorizeBehind(0, true)).toBe("keepUp");
  });

  it("behind=0 and isReleasing=false → neither (fully caught up on a finished show)", () => {
    expect(categorizeBehind(0, false)).toBe("neither");
  });

  it("behind > 0 → Catch Up regardless of isReleasing", () => {
    expect(categorizeBehind(3, true)).toBe("catchUp");
    expect(categorizeBehind(3, false)).toBe("catchUp");
  });
});
