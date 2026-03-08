import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const excludeId = Number(req.nextUrl.searchParams.get("excludeId") ?? "0");
  // Optionally filter to a specific link (to exclude anime already in that link)
  const excludeLinkId = Number(req.nextUrl.searchParams.get("excludeLinkId") ?? "0");

  if (q.length < 2) return NextResponse.json([]);

  const results = await db.anime.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      AND: [
        // Show anime that are in this user's library (in any of their Links)
        { linkedIn: { some: { link: { userId } } } },
        // Optionally exclude anime already in a specific link
        ...(excludeLinkId ? [{ linkedIn: { none: { linkId: excludeLinkId } } }] : []),
      ],
      OR: [
        { titleEnglish: { contains: q, mode: "insensitive" } },
        { titleRomaji: { contains: q, mode: "insensitive" } },
      ],
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
}
