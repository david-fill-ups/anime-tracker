import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { wrapHandler } from "@/lib/validation";

const DEFAULT_SOURCES = [
  "Crunchyroll",
  "Netflix",
  "Amazon Prime",
  "HIDIVE",
  "Hulu",
  "Disney+",
  "TikTok",
  "YouTube",
  "Reddit",
  "Instagram",
  "Twitter / X",
  "AniList",
  "MyAnimeList",
];

export async function GET() {
  return wrapHandler(async () => {
    const userId = await requireUserId();

    const rows = await db.userEntry.findMany({
      where: { userId, discoverySource: { not: null } },
      select: { discoverySource: true },
      distinct: ["discoverySource"],
    });

    const userSources = rows.map((r) => r.discoverySource as string);

    // Merge defaults + user values, deduped, preserving user values first
    const merged = Array.from(new Set([...userSources, ...DEFAULT_SOURCES]));

    return NextResponse.json({ sources: merged });
  });
}
