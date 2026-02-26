import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { WatchStatus, DisplayFormat, WatchContext } from "@/app/generated/prisma";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const status = params.get("status");
  const franchise = params.get("franchise");
  const format = params.get("format");
  const context = params.get("context");
  const search = params.get("search");

  const where: Record<string, unknown> = { userEntry: { isNot: null } };
  if (status) where.userEntry = { watchStatus: status as WatchStatus };
  if (franchise) where.franchiseEntries = { some: { franchiseId: Number(franchise) } };
  if (format) where.displayFormat = format as DisplayFormat;
  if (context) {
    const contextFilter = { watchContext: context as WatchContext };
    where.userEntry =
      typeof where.userEntry === "object" && where.userEntry !== null
        ? { ...where.userEntry, ...contextFilter }
        : contextFilter;
  }
  if (search) {
    where.OR = [
      { titleEnglish: { contains: search } },
      { titleRomaji: { contains: search } },
    ];
  }

  const animes = await db.anime.findMany({
    where,
    include: {
      userEntry: { include: { recommender: true } },
      franchiseEntries: { include: { franchise: true }, orderBy: { order: "asc" } },
      animeStudios: { include: { studio: true }, where: { isMainStudio: true } },
    },
    orderBy: { userEntry: { updatedAt: "desc" } },
  });

  const rows = [
    [
      "Title",
      "Status",
      "Current Episode",
      "Total Episodes",
      "Score",
      "Community Score",
      "Format",
      "Franchise",
      "Main Studio",
      "Genres",
      "Airing Status",
      "Season",
      "Watch Context",
      "Watch Party With",
      "Recommended By",
      "Started",
      "Completed",
      "Rewatch Count",
      "Notes",
    ],
    ...animes.map((a) => {
      const e = a.userEntry!;
      const genres: string[] = JSON.parse(a.genres || "[]");
      return [
        a.titleEnglish || a.titleRomaji,
        e.watchStatus,
        String(e.currentEpisode),
        a.totalEpisodes ? String(a.totalEpisodes) : "",
        e.score != null ? String(e.score) : "",
        a.meanScore != null ? String(a.meanScore) : "",
        a.displayFormat,
        a.franchiseEntries[0]?.franchise.name ?? "",
        a.animeStudios[0]?.studio.name ?? "",
        genres.join("; "),
        a.airingStatus,
        a.season && a.seasonYear ? `${a.season} ${a.seasonYear}` : "",
        e.watchContext ?? "",
        e.watchPartyWith ?? "",
        e.recommender?.name ?? "",
        e.startedAt ? e.startedAt.toISOString().split("T")[0] : "",
        e.completedAt ? e.completedAt.toISOString().split("T")[0] : "",
        String(e.rewatchCount),
        (e.notes ?? "").replace(/[\n\r]/g, " "),
      ];
    }),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="anime-tracker-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
