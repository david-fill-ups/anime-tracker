import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { wrapHandler } from "@/lib/validation";
import { searchAnimeIdsByTitle } from "@/lib/anime-utils";

export async function GET(req: NextRequest) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const excludeId = Number(req.nextUrl.searchParams.get("excludeId") ?? "0");
    // Optionally filter to a specific link (to exclude anime already in that link)
    const excludeLinkId = Number(req.nextUrl.searchParams.get("excludeLinkId") ?? "0");

    if (q.length < 2) return NextResponse.json([]);

    // Two-step exclusion avoids a Prisma bug where `some` + `none` on the same
    // relation in an AND array can produce incorrect results.
    let excludeAnimeIds: number[] = [];
    if (excludeLinkId) {
      const linked = await db.linkedAnime.findMany({
        where: { linkId: excludeLinkId },
        select: { animeId: true },
      });
      excludeAnimeIds = linked.map((la) => la.animeId);
    }

    const allMatchingIds = await searchAnimeIdsByTitle(q);
    const matchingIds = allMatchingIds.filter(
      (id) => id !== excludeId && !excludeAnimeIds.includes(id)
    );
    if (matchingIds.length === 0) return NextResponse.json([]);

    const results = await db.anime.findMany({
      where: {
        id: { in: matchingIds },
        linkedIn: { some: { link: { userId } } },
      },
      select: {
        id: true,
        titleEnglish: true,
        titleRomaji: true,
        anilistId: true,
        season: true,
        seasonYear: true,
        totalEpisodes: true,
        airingStatus: true,
      },
      take: 8,
    });

    return NextResponse.json(results);
  });
}
