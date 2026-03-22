import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import type { WatchStatus, DisplayFormat } from "@/app/generated/prisma";
import { wrapHandler } from "@/lib/validation";

export async function GET(req: NextRequest) {
  return wrapHandler(async () => {
  const userId = await requireUserId();
  const params = req.nextUrl.searchParams;
  const status = params.get("status");
  const franchise = params.get("franchise");
  const format = params.get("format");
  const search = params.get("search");

  // Query via Links — each Link = one row in the export
  // The "primary" display anime is linkedAnime[0] (order 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userEntryWhere: Record<string, any> = {};
  if (status) userEntryWhere.watchStatus = status as WatchStatus;

  const links = await db.link.findMany({
    where: {
      userId,
      userEntry: Object.keys(userEntryWhere).length > 0 ? { is: userEntryWhere } : { isNot: null },
    },
    include: {
      userEntry: { include: { recommender: true } },
      linkedAnime: {
        include: {
          anime: {
            include: {
              franchiseEntries: { include: { franchise: true }, orderBy: { order: "asc" } },
              animeStudios: { include: { studio: true }, where: { isMainStudio: true } },
              streamingLinks: { orderBy: { service: "asc" } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Apply remaining filters (franchise, format, search) against the primary anime
  const filtered = links.filter((link) => {
    const primary = link.linkedAnime[0]?.anime;
    if (!primary) return false;
    if (format && primary.displayFormat !== (format as DisplayFormat)) return false;
    if (franchise && !primary.franchiseEntries.some((fe) => fe.franchiseId === Number(franchise))) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchEn = primary.titleEnglish?.toLowerCase().includes(q) ?? false;
      const matchRo = primary.titleRomaji.toLowerCase().includes(q);
      if (!matchEn && !matchRo) return false;
    }
    return true;
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
      "TMDB ID",
      "Linked AniList IDs",
      "Streaming Links",
    ],
    ...filtered.map((link) => {
      const e = link.userEntry!;
      const primary = link.linkedAnime[0]!.anime;
      let genres: string[] = [];
      try { genres = JSON.parse(primary.genres || "[]"); } catch { genres = []; }
      // All linked anime IDs (excluding the primary)
      const linkedIds = link.linkedAnime
        .slice(1)
        .map((la) => la.anime.anilistId)
        .filter(Boolean)
        .join("; ");

      const franchiseStr = primary.franchiseEntries
        .map((fe) => `${fe.franchise.name}|${fe.order}|${fe.entryType}`)
        .join("; ");

      const streamingStr = primary.streamingLinks
        .map((sl) => `${sl.service}:${sl.url}`)
        .join("; ");

      return [
        primary.anilistId != null ? String(primary.anilistId) : "",
        primary.titleEnglish || primary.titleRomaji,
        e.watchStatus,
        String(e.currentEpisode),
        link.linkedAnime.reduce((s, la) => s + (la.anime.totalEpisodes ?? 0), 0)
          ? String(link.linkedAnime.reduce((s, la) => s + (la.anime.totalEpisodes ?? 0), 0))
          : "",
        e.score != null ? String(e.score) : "",
        primary.meanScore != null ? String(primary.meanScore) : "",
        primary.displayFormat,
        franchiseStr,
        primary.animeStudios[0]?.studio.name ?? "",
        genres.join("; "),
        primary.airingStatus,
        primary.season && primary.seasonYear ? `${primary.season} ${primary.seasonYear}` : "",
        e.recommender?.name ?? "",
        e.startedAt ? e.startedAt.toISOString().split("T")[0] : "",
        e.completedAt ? e.completedAt.toISOString().split("T")[0] : "",
        (e.notes ?? "").replace(/[\n\r]/g, " "),
        primary.tmdbId != null ? String(primary.tmdbId) : "",
        linkedIds,
        streamingStr,
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
  });
}
