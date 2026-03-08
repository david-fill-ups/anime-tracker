"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { AiringStatus, Season } from "@/app/generated/prisma";

export type LinkedAnimeSummary = {
  id: number; // LinkedAnime.id
  order: number;
  anime: {
    id: number;
    titleRomaji: string;
    titleEnglish: string | null;
    anilistId: number | null;
    season: Season | null;
    seasonYear: number | null;
    totalEpisodes: number | null;
    airingStatus: AiringStatus;
  };
};

const STATUS_LABELS: Partial<Record<AiringStatus, string>> = {
  FINISHED: "Finished",
  RELEASING: "Airing",
  NOT_YET_RELEASED: "Upcoming",
  HIATUS: "Hiatus",
  CANCELLED: "Cancelled",
};

type LibraryResult = {
  source: "library";
  id: number;
  titleEnglish: string | null;
  titleRomaji: string;
  anilistId: number | null;
  season: Season | null;
  seasonYear: number | null;
  totalEpisodes: number | null;
  airingStatus: AiringStatus;
};

type AniListResult = {
  source: "anilist";
  anilistId: number;
  titleEnglish: string | null;
  titleRomaji: string;
  season: string | null;
  seasonYear: number | null;
  episodes: number | null;
  status: AiringStatus;
};

type SearchResult = LibraryResult | AniListResult;

function resultTitle(r: SearchResult) {
  return r.titleEnglish ?? r.titleRomaji;
}

function resultMeta(r: SearchResult) {
  const year = r.seasonYear;
  const season = r.season;
  const eps = r.source === "library" ? r.totalEpisodes : r.episodes;
  const yearStr = year ? ` · ${season ? season.charAt(0) + season.slice(1).toLowerCase() + " " : ""}${year}` : "";
  const epsStr = eps ? ` · ${eps} eps` : "";
  return yearStr + epsStr;
}

export default function LinkManager({
  linkId,
  linkedAnime,
}: {
  linkId: number;
  linkedAnime: LinkedAnimeSummary[];
}) {
  const router = useRouter();
  const [localOrder, setLocalOrder] = useState<LinkedAnimeSummary[]>(
    [...linkedAnime].sort((a, b) => a.order - b.order)
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when prop changes (after router.refresh())
  useEffect(() => {
    setLocalOrder([...linkedAnime].sort((a, b) => a.order - b.order));
  }, [linkedAnime]);

  async function handleReorder(fromIndex: number, toIndex: number) {
    const newOrder = [...localOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setLocalOrder(newOrder);
    setReordering(true);
    try {
      const res = await fetch(`/api/links/${linkId}/order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedAnimeIds: newOrder.map((la) => la.anime.id) }),
      });
      if (res.ok) router.refresh();
    } finally {
      setReordering(false);
    }
  }

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => doSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function doSearch(q: string) {
    setSearching(true);
    try {
      const [libRes, alRes] = await Promise.all([
        fetch(`/api/anime/search?q=${encodeURIComponent(q)}&excludeLinkId=${linkId}`),
        fetch(`/api/anilist/search?q=${encodeURIComponent(q)}`),
      ]);
      const [lib, al]: [
        LibraryResult[],
        { id: number; title: { english: string | null; romaji: string }; season: string | null; seasonYear: number | null; episodes: number | null; status: AiringStatus }[]
      ] = await Promise.all([libRes.json(), alRes.json()]);

      const libraryResults: LibraryResult[] = lib.map((r) => ({ ...r, source: "library" as const }));
      const libAnilistIds = new Set(libraryResults.map((r) => r.anilistId).filter(Boolean));

      const anilistResults: AniListResult[] = al
        .filter((r) => !libAnilistIds.has(r.id))
        .map((r) => ({
          source: "anilist" as const,
          anilistId: r.id,
          titleEnglish: r.title.english ?? null,
          titleRomaji: r.title.romaji,
          season: r.season,
          seasonYear: r.seasonYear,
          episodes: r.episodes,
          status: r.status,
        }));

      setResults([...libraryResults, ...anilistResults]);
    } finally {
      setSearching(false);
    }
  }

  async function handleSelect(result: SearchResult) {
    setAdding(true);
    setError(null);
    try {
      const body =
        result.source === "library"
          ? { animeId: result.id }
          : { anilistId: result.anilistId };

      const res = await fetch(`/api/links/${linkId}/anime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? "Failed to add to link");
      } else {
        setQuery("");
        setResults([]);
        router.refresh();
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(animeId: number) {
    setRemoving(animeId);
    setError(null);
    try {
      const res = await fetch(`/api/links/${linkId}/anime/${animeId}`, { method: "DELETE" });
      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? "Failed to remove");
      } else {
        router.refresh();
      }
    } finally {
      setRemoving(null);
    }
  }

  const libraryResults = results.filter((r): r is LibraryResult => r.source === "library");
  const anilistResults = results.filter((r): r is AniListResult => r.source === "anilist");
  const showResults = query.trim().length >= 2 && (searching || results.length > 0);

  return (
    <div className="space-y-3">
      {localOrder.length > 1 && (
        <h3 className="text-sm font-semibold text-slate-300">Linked Anime</h3>
      )}

      {localOrder.length > 1 && (
        <div className="space-y-1">
          {localOrder.map((la, i) => {
            const title = la.anime.titleEnglish ?? la.anime.titleRomaji;
            const yearStr = la.anime.seasonYear
              ? ` · ${la.anime.season ? la.anime.season.charAt(0) + la.anime.season.slice(1).toLowerCase() + " " : ""}${la.anime.seasonYear}`
              : "";
            const epsStr = la.anime.totalEpisodes ? ` · ${la.anime.totalEpisodes} eps` : "";
            const statusStr = STATUS_LABELS[la.anime.airingStatus] ?? la.anime.airingStatus;
            return (
              <div
                key={la.id}
                className="flex items-center justify-between gap-3 bg-slate-800 rounded-lg px-3 py-2 text-sm"
              >
                {localOrder.length > 1 && (
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => handleReorder(i, i - 1)}
                      disabled={i === 0 || reordering}
                      className="text-slate-600 hover:text-slate-300 disabled:opacity-20 disabled:cursor-default leading-none"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleReorder(i, i + 1)}
                      disabled={i === localOrder.length - 1 || reordering}
                      className="text-slate-600 hover:text-slate-300 disabled:opacity-20 disabled:cursor-default leading-none"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>
                )}
                <span className="text-slate-300 flex-1 truncate">
                  {title}
                  <span className="text-slate-500">{yearStr}{epsStr}</span>
                  <span className="ml-2 text-xs text-slate-500">{statusStr}</span>
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {la.anime.anilistId && (
                    <a
                      href={`https://anilist.co/anime/${la.anime.anilistId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      AniList ↗
                    </a>
                  )}
                  {localOrder.length > 1 && (
                    <button
                      onClick={() => handleRemove(la.anime.id)}
                      disabled={removing === la.anime.id}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {removing === la.anime.id ? "…" : "Remove"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={localOrder.length > 1 ? "Search to add a linked anime…" : "Link another anime (e.g. a sequel season)…"}
            className="flex-1 text-sm bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults([]); }}
              className="text-sm text-slate-500 hover:text-slate-300 px-2"
            >
              ✕
            </button>
          )}
        </div>

        {showResults && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            {searching && results.length === 0 && (
              <p className="text-xs text-slate-500 px-3 py-2">Searching…</p>
            )}
            {!searching && results.length === 0 && (
              <p className="text-xs text-slate-500 px-3 py-2">No results found</p>
            )}

            {libraryResults.length > 0 && (
              <>
                <p className="text-xs text-slate-500 px-3 pt-2 pb-1 font-medium uppercase tracking-wide">
                  From your library
                </p>
                {libraryResults.map((r) => (
                  <button
                    key={`lib-${r.id}`}
                    onClick={() => handleSelect(r)}
                    disabled={adding}
                    className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    <span className="text-sm text-slate-200 truncate">
                      {resultTitle(r)}
                      <span className="text-slate-500 text-xs">{resultMeta(r)}</span>
                    </span>
                    <span className="text-xs text-emerald-500 flex-shrink-0">In library</span>
                  </button>
                ))}
              </>
            )}

            {anilistResults.length > 0 && (
              <>
                <p className="text-xs text-slate-500 px-3 pt-2 pb-1 font-medium uppercase tracking-wide">
                  From AniList
                </p>
                {anilistResults.map((r) => (
                  <button
                    key={`al-${r.anilistId}`}
                    onClick={() => handleSelect(r)}
                    disabled={adding}
                    className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    <span className="text-sm text-slate-200 truncate">
                      {resultTitle(r)}
                      <span className="text-slate-500 text-xs">{resultMeta(r)}</span>
                    </span>
                    <span className="text-xs text-indigo-400 flex-shrink-0">AniList</span>
                  </button>
                ))}
              </>
            )}

            {adding && <p className="text-xs text-slate-500 px-3 py-2">Adding…</p>}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
