import { NextRequest, NextResponse } from "next/server";
import { wrapHandler, URLIdSchema } from "@/lib/validation";
import { requireUserId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { refreshStreamingForAnime } from "@/lib/tmdb";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const animeId = URLIdSchema.parse(id);

    const owned = await db.linkedAnime.findFirst({ where: { animeId, link: { userId } } });
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await refreshStreamingForAnime(animeId);
    return NextResponse.json({ ok: true });
  });
}
