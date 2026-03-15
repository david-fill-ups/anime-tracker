export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import LibraryFilters from "@/components/LibraryFilters";
import AnimeGrid from "@/components/AnimeGrid";
import LibraryUrlSaver from "@/components/LibraryUrlSaver";
import type { WatchStatus, DisplayFormat, AiringStatus } from "@/app/generated/prisma";
import { effectiveTotalEpisodesFromLink, effectiveAiringStatusFromLink } from "@/lib/anime-utils";
import LibraryRefreshFooter from "@/components/LibraryRefreshFooter";

// Statuses that belong to the Library (watched / watching)
const LIBRARY_STATUSES: WatchStatus[] = ["WATCHING", "COMPLETED", "DROPPED"];
// All statuses that can be explicitly filtered via the filters page
const ALL_FILTERABLE_STATUSES: WatchStatus[] = [...LIBRARY_STATUSES, "NOT_INTERESTED"];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const params = await searchParams;
  const { status, search, franchise, format, context, recommender, sort = "updatedAt", order, genre, studio, minScore, maxScore } = params;

  // Build the userEntry filter (always scoped to this user)
  const userEntryFilter: Record<string, unknown> = {};

  const statusList = status
    ? (status.split(",").filter((s) => ALL_FILTERABLE_STATUSES.includes(s as WatchStatus)) as WatchStatus[])
    : [];

  if (statusList.length === 0) {
    userEntryFilter.watchStatus = { in: LIBRARY_STATUSES };
  } else if (statusList.length === 1) {
    userEntryFilter.watchStatus = statusList[0];
  } else {
    userEntryFilter.watchStatus = { in: statusList };
  }

  if (context === "NONE") {
    userEntryFilter.watchContextPersonId = null;
  } else if (context) {
    userEntryFilter.watchContextPersonId = Number(context);
  }

  if (recommender) {
    userEntryFilter.recommenderId = Number(recommender);
  }

  if (minScore || maxScore) {
    const scoreFilter: Record<string, number> = {};
    if (minScore) scoreFilter.gte = parseFloat(minScore);
    if (maxScore) scoreFilter.lte = parseFloat(maxScore);
    userEntryFilter.score = scoreFilter;
  }

  // Filter to "primary" anime (order=0 in their Link) owned by this user
  const where: Record<string, unknown> = {
    linkedIn: {
      some: {
        order: 0,
        link: { userId, userEntry: { is: userEntryFilter } },
      },
    },
  };

  // Collect AND conditions so title-search OR and genre OR don't overwrite each other
  const andConditions: Record<string, unknown>[] = [];

  if (search) {
    andConditions.push({
      OR: [
        { titleEnglish: { contains: search, mode: "insensitive" } },
        { titleRomaji: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (franchise) {
    where.franchiseEntries = { some: { franchiseId: Number(franchise) } };
  }

  if (format) {
    where.displayFormat = format as DisplayFormat;
  }

  if (genre) {
    const genreList = genre.split(",").filter(Boolean);
    // Wrap genre in quotes to match the JSON string representation exactly
    // e.g. `"Action"` in `["Action","Adventure"]` — prevents partial-word false positives
    if (genreList.length === 1) {
      andConditions.push({ genres: { contains: `"${genreList[0]}"` } });
    } else {
      andConditions.push({ OR: genreList.map((g) => ({ genres: { contains: `"${g}"` } })) });
    }
  }

  if (studio) {
    const studioList = studio.split(",").filter(Boolean);
    if (studioList.length === 1) {
      where.animeStudios = { some: { isMainStudio: true, studio: { name: studioList[0] } } };
    } else {
      andConditions.push({
        OR: studioList.map((s) => ({
          animeStudios: { some: { isMainStudio: true, studio: { name: s } } },
        })),
      });
    }
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  // Build sort — use aggregation ordering for userEntry fields
  const sortDir = (order === "asc" ? "asc" : "desc") as "asc" | "desc";
  const orderBy = buildOrderBy(sort, sortDir);

  const include = {
    // Include Link + all linkedAnime for episode/airing aggregation + userEntry
    linkedIn: {
      where: { order: 0, link: { userId } },
      include: {
        link: {
          include: {
            linkedAnime: {
              include: { anime: { select: { totalEpisodes: true, airingStatus: true } } },
              orderBy: { order: "asc" as const },
            },
            userEntry: { include: { recommender: true, watchContextPerson: true } },
          },
        },
      },
      take: 1,
    },
    franchiseEntries: { include: { franchise: true } },
    animeStudios: { include: { studio: true } },
  };

  const [rawAnimes, franchises, people, rawCounts, mostRecentSync] = await Promise.all([
    db.anime.findMany({ where, include, orderBy }),
    db.franchise.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.person.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.userEntry.groupBy({
      by: ["watchStatus"],
      _count: { watchStatus: true },
      where: { watchStatus: { in: ALL_FILTERABLE_STATUSES }, userId },
    }),
    db.anime.findFirst({
      where: {
        linkedIn: {
          some: {
            order: 0,
            link: { userId, userEntry: { is: { watchStatus: { in: LIBRARY_STATUSES } } } },
          },
        },
        lastSyncedAt: { not: null },
      },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    }),
  ]);

  // Transform: extract userEntry and compute effective totals from Link's linked anime
  const animes = rawAnimes
    .map((a) => {
      const link = a.linkedIn[0]?.link;
      return {
        ...a,
        link: link ?? null,
        userEntry: link?.userEntry ?? null,
        totalEpisodes: link ? effectiveTotalEpisodesFromLink(link.linkedAnime) : a.totalEpisodes,
        airingStatus: link
          ? (effectiveAiringStatusFromLink(link.linkedAnime) as AiringStatus)
          : (a.airingStatus as AiringStatus),
      };
    })
    .sort((a, b) => {
      const ae = a.userEntry;
      const be = b.userEntry;
      const flip = sortDir === "asc" ? -1 : 1;
      if (sort === "startedAt")
        return flip * ((be?.startedAt?.getTime() ?? 0) - (ae?.startedAt?.getTime() ?? 0));
      if (sort === "completedAt")
        return flip * ((be?.completedAt?.getTime() ?? 0) - (ae?.completedAt?.getTime() ?? 0));
      if (sort === "score")
        return flip * ((be?.score ?? -1) - (ae?.score ?? -1));
      if (sort === "meanScore" || sort === "title")
        return 0; // already ordered by Prisma
      // default: updatedAt
      return flip * ((be?.updatedAt?.getTime() ?? 0) - (ae?.updatedAt?.getTime() ?? 0));
    });

  // Build status counts (library statuses only)
  const counts: Partial<Record<WatchStatus | "ALL", number>> = {};
  let total = 0;
  for (const row of rawCounts) {
    counts[row.watchStatus] = row._count.watchStatus;
    total += row._count.watchStatus;
  }
  counts["ALL"] = total;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Library</h2>
      </div>

      <Suspense>
        <LibraryFilters franchises={franchises} people={people} counts={counts} />
        <LibraryUrlSaver />
      </Suspense>

      <AnimeGrid animes={animes} />
      <LibraryRefreshFooter lastSyncedAt={mostRecentSync?.lastSyncedAt?.toISOString() ?? null} />
    </div>
  );
}

function buildOrderBy(sort: string, dir: "asc" | "desc"): Record<string, unknown> {
  // Only DB-level sorts (not user-entry fields — those are sorted client-side)
  if (sort === "meanScore") return { meanScore: dir };
  if (sort === "title") return { titleEnglish: dir };
  return { updatedAt: dir }; // fallback; actual updatedAt sort applied client-side
}
