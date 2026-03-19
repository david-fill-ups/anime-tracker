import { NextRequest, NextResponse } from "next/server";
import { searchAniList } from "@/lib/anilist";
import { wrapHandler } from "@/lib/validation";
import { requireUserId } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  return wrapHandler(async () => {
    await requireUserId();
    const q = req.nextUrl.searchParams.get("q");
    if (!q || q.trim().length < 2) {
      return NextResponse.json([]);
    }
    const results = await searchAniList(q.trim());
    return NextResponse.json(results);
  });
}
