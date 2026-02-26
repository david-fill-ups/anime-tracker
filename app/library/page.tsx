export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { Suspense } from "react";
import LibraryFilters from "@/components/LibraryFilters";
import AnimeGrid from "@/components/AnimeGrid";
import type { WatchStatus, DisplayFormat, WatchContext } from "@/app/generated/prisma";

const include = {
  userEntry: { include: { recommender: true } },
  franchiseEntries: { include: { franchise: true } },
  animeStudios: { include: { studio: true } },
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const { status, search, franchise, format, context, sort = "updatedAt" } = params;

  // Build filters
  const where: Record<string, unknown> = {};

  if (status) {
    where.userEntry = { watchStatus: status as WatchStatus };
  } else {
    // Exclude anime with no user entry from the default view
    where.userEntry = { isNot: null };
  }

  if (search) {
    where.OR = [
      { titleEnglish: { contains: search, mode: "insensitive" } },
      { titleRomaji: { contains: search, mode: "insensitive" } },
    ];
  }

  if (franchise) {
    where.franchiseEntries = { some: { franchiseId: Number(franchise) } };
  }

  if (format) {
    where.displayFormat = format as DisplayFormat;
  }

  if (context) {
    const contextFilter = { watchContext: context as WatchContext };
    where.userEntry =
      typeof where.userEntry === "object" && where.userEntry !== null
        ? { ...where.userEntry, ...contextFilter }
        : contextFilter;
  }

  // Build sort
  const orderBy = buildOrderBy(sort);

  const [animes, franchises, rawCounts] = await Promise.all([
    db.anime.findMany({ where, include, orderBy }),
    db.franchise.findMany({ orderBy: { name: "asc" } }),
    db.userEntry.groupBy({
      by: ["watchStatus"],
      _count: { watchStatus: true },
    }),
  ]);

  // Build status counts
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
        <a
          href="/api/export"
          className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md transition-colors"
        >
          Export CSV
        </a>
      </div>

      <Suspense>
        <LibraryFilters franchises={franchises} counts={counts} />
      </Suspense>

      <AnimeGrid animes={animes} />
    </div>
  );
}

function buildOrderBy(sort: string): Record<string, unknown> {
  switch (sort) {
    case "startedAt":
      return { userEntry: { startedAt: "desc" } };
    case "completedAt":
      return { userEntry: { completedAt: "desc" } };
    case "score":
      return { userEntry: { score: "desc" } };
    case "meanScore":
      return { meanScore: "desc" };
    case "title":
      return { titleEnglish: "asc" };
    default:
      return { userEntry: { updatedAt: "desc" } };
  }
}
