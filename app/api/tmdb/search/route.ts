import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/validation";
import { requireUserId } from "@/lib/auth-helpers";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w92";

interface TmdbSearchResult {
  id: number;
  name?: string;
  title?: string;
  first_air_date?: string;
  release_date?: string;
  poster_path?: string | null;
}

interface TmdbSearchResponse {
  results: TmdbSearchResult[];
}

export async function GET(req: NextRequest) {
  return wrapHandler(async () => {
    await requireUserId();
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const type = (req.nextUrl.searchParams.get("type") ?? "tv") as "tv" | "movie";

    if (q.length < 2) {
      return NextResponse.json([]);
    }

    const token = process.env.TMDB_API_TOKEN;
    if (!token) {
      return NextResponse.json([]);
    }

    const url = `${TMDB_BASE}/search/${type}?query=${encodeURIComponent(q)}&include_adult=false`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json([]);
    }

    const data = (await res.json()) as TmdbSearchResponse;
    const results = (data.results ?? []).slice(0, 10).map((r) => ({
      id: r.id,
      name: r.name ?? r.title ?? "Unknown",
      year: (r.first_air_date ?? r.release_date ?? "").split("-")[0] || null,
      mediaType: type,
      posterUrl: r.poster_path ? `${TMDB_IMAGE_BASE}${r.poster_path}` : null,
    }));

    return NextResponse.json(results);
  });
}
