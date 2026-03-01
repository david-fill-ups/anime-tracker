import { NextRequest, NextResponse } from "next/server";
import { refreshStreamingForAnime } from "@/lib/tmdb";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const animeId = Number(id);

  if (isNaN(animeId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await refreshStreamingForAnime(animeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[streaming/refresh] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
