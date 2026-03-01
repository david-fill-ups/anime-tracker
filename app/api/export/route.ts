import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import type { WatchStatus, DisplayFormat } from "@/app/generated/prisma";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  const params = req.nextUrl.searchParams;
  const status = params.get("status");
  const franchise = params.get("franchise");
  const format = params.get("format");
  const search = params.get("search");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    userEntries: { some: { userId } },
    mergedIntoId: null,
  };
  if (status) where.userEntries = { some: { userId, watchStatus: status as WatchStatus } };
  if (franchise) where.franchiseEntries = { some: { franchiseId: Number(franchise) } };
  if (format) where.displayFormat = format as DisplayFormat;
  if (search) {
    where.OR = [
      { titleEnglish: { contains: search } },
      { titleRomaji: { contains: search } },
    ];
  }

  const animes = await db.anime.findMany({
    where,
    include: {
      userEntries: { where: { userId }, include: { recommender: true }, take: 1 },
      franchiseEntries: { include: { franchise: true }, orderBy: { order: "asc" } },
      animeStudios: { include: { studio: true }, where: { isMainStudio: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const rows = [
    [
      "AniList ID",
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
      "Recommended By",
      "Started",
      "Completed",
      "Notes",
    ],
    ...animes.map((a) => {
      const e = a.userEntries[0]!;
      const genres: string[] = JSON.parse(a.genres || "[]");
      return [
        a.anilistId != null ? String(a.anilistId) : "",
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
        e.recommender?.name ?? "",
        e.startedAt ? e.startedAt.toISOString().split("T")[0] : "",
        e.completedAt ? e.completedAt.toISOString().split("T")[0] : "",
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
