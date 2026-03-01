export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import LibraryFilters from "@/components/LibraryFilters";
import AnimeGrid from "@/components/AnimeGrid";
import type { WatchStatus, DisplayFormat, AiringStatus } from "@/app/generated/prisma";
import { effectiveTotalEpisodes, effectiveAiringStatus, MERGED_ANIME_SELECT } from "@/lib/anime-utils";

// Statuses that belong to the Library (watched / watching)
const LIBRARY_STATUSES: WatchStatus[] = ["WATCHING", "COMPLETED", "ON_HOLD", "DROPPED"];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const params = await searchParams;
  const { status, search, franchise, format, context, sort = "updatedAt", genre, studio, verified } = params; // TODO[TEMP]: verified

  // Build the userEntry filter (always scoped to this user)
  const userEntryFilter: Record<string, unknown> = { userId };

  if (status && LIBRARY_STATUSES.includes(status as WatchStatus)) {
    userEntryFilter.watchStatus = status as WatchStatus;
  } else {
    userEntryFilter.watchStatus = { in: LIBRARY_STATUSES };
  }

  if (context) {
    userEntryFilter.watchContextPersonId = Number(context);
  }

  // TODO[TEMP]: verified filter — remove after data review
  if (verified === "true" || verified === "false") {
    userEntryFilter.verified = verified === "true";
  }

  // Build anime filters
  const where: Record<string, unknown> = {
    userEntries: { some: userEntryFilter },
    mergedIntoId: null,
  };

  if (search) {
    where.OR = [
      { titleEnglish: { contains: search } },
      { titleRomaji: { contains: search } },
    ];
  }

  if (franchise) {
    where.franchiseEntries = { some: { franchiseId: Number(franchise) } };
  }

  if (format) {
    where.displayFormat = format as DisplayFormat;
  }

  if (genre) {
    where.genres = { contains: genre };
  }

  if (studio) {
    where.animeStudios = { some: { isMainStudio: true, studio: { name: studio } } };
  }

  // Build sort — use aggregation ordering for userEntry fields
  const orderBy = buildOrderBy(sort);

  const include = {
    userEntries: {
      where: { userId },
      include: { recommender: true, watchContextPerson: true },
      take: 1,
    },
    franchiseEntries: { include: { franchise: true } },
    animeStudios: { include: { studio: true } },
    mergedAnimes: { select: MERGED_ANIME_SELECT },
  };

  const [rawAnimes, franchises, people, rawCounts] = await Promise.all([
    db.anime.findMany({ where, include, orderBy }),
    db.franchise.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.person.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.userEntry.groupBy({
      by: ["watchStatus"],
      _count: { watchStatus: true },
      where: { watchStatus: { in: LIBRARY_STATUSES }, userId },
    }),
  ]);

  // Transform userEntries[] -> userEntry, compute effective totals for merged seasons,
  // then sort client-side for user-entry fields
  // (Prisma 7.4 doesn't support _max aggregate ordering on one-to-many relations)
  const animes = rawAnimes
    .map((a) => ({
      ...a,
      userEntry: a.userEntries[0] ?? null,
      totalEpisodes: effectiveTotalEpisodes(a),
      airingStatus: effectiveAiringStatus(a) as AiringStatus,
    }))
    .sort((a, b) => {
      const ae = a.userEntry;
      const be = b.userEntry;
      if (sort === "startedAt")
        return (be?.startedAt?.getTime() ?? 0) - (ae?.startedAt?.getTime() ?? 0);
      if (sort === "completedAt")
        return (be?.completedAt?.getTime() ?? 0) - (ae?.completedAt?.getTime() ?? 0);
      if (sort === "score")
        return (be?.score ?? -1) - (ae?.score ?? -1);
      if (sort === "meanScore" || sort === "title")
        return 0; // already ordered by Prisma
      // default: updatedAt
      return (be?.updatedAt?.getTime() ?? 0) - (ae?.updatedAt?.getTime() ?? 0);
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
      </Suspense>

      <AnimeGrid animes={animes} />
    </div>
  );
}

function buildOrderBy(sort: string): Record<string, unknown> {
  // Only DB-level sorts (not user-entry fields — those are sorted client-side)
  if (sort === "meanScore") return { meanScore: "desc" };
  if (sort === "title") return { titleEnglish: "asc" };
  return { updatedAt: "desc" }; // fallback; actual updatedAt sort applied client-side
}
