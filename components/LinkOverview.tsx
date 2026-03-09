"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { AiringStatus, Season } from "@/app/generated/prisma";

export type LinkedAnimeCard = {
  id: number; // LinkedAnime.id
  order: number;
  anime: {
    id: number;
    titleRomaji: string;
    titleEnglish: string | null;
    coverImageUrl: string | null;
    totalEpisodes: number | null;
    meanScore: number | null;
    airingStatus: AiringStatus;
    season: string | null;
    seasonYear: number | null;
    displayFormat: string;
  };
};

type LinkOverviewProps = {
  linkId: number;
  linkName: string | null;
  linkedAnime: LinkedAnimeCard[];
  onSelectAnime: (animeId: number) => void;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  FINISHED:         { label: "Finished",  className: "text-green-400" },
  RELEASING:        { label: "Airing",    className: "text-blue-400" },
  HIATUS:           { label: "Hiatus",    className: "text-amber-400" },
  CANCELLED:        { label: "Cancelled", className: "text-red-400" },
  NOT_YET_RELEASED: { label: "Upcoming",  className: "text-slate-400" },
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

export default function LinkOverview({ linkId, linkName, linkedAnime, onSelectAnime }: LinkOverviewProps) {
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(linkName ?? "");
  const [savingName, setSavingName] = useState(false);

  // Local ordered list for optimistic DnD reordering
  const [localAnime, setLocalAnime] = useState(() => [...linkedAnime].sort((a, b) => a.order - b.order));
  const draggingIdRef = useRef<number | null>(null);
  const dragOverIdRef = useRef<number | null>(null);

  // Sync from props when server data changes (after router.refresh())
  const animeKey = linkedAnime.map((la) => `${la.id}:${la.order}`).join(",");
  useEffect(() => {
    setLocalAnime([...linkedAnime].sort((a, b) => a.order - b.order));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeKey]);

  const displayName = linkName ?? (localAnime[0]?.anime.titleEnglish ?? localAnime[0]?.anime.titleRomaji ?? "");

  // Add-anime state
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<SearchResult[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleSaveName() {
    setSavingName(true);
    try {
      const res = await fetch(`/api/links/${linkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue.trim() || null }),
      });
      if (res.ok) {
        setEditingName(false);
        router.refresh();
      }
    } finally {
      setSavingName(false);
    }
  }

  useEffect(() => {
    if (addQuery.trim().length < 2) { setAddResults([]); return; }
    const timer = setTimeout(() => doSearch(addQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [addQuery]);

  async function doSearch(q: string) {
    setAddSearching(true);
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
      setAddResults([...libraryResults, ...anilistResults]);
    } finally {
      setAddSearching(false);
    }
  }

  async function handleAddSelect(result: SearchResult) {
    setAdding(true);
    setAddError(null);
    try {
      const body = result.source === "library" ? { animeId: result.id } : { anilistId: result.anilistId };
      const res = await fetch(`/api/links/${linkId}/anime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        setAddError(msg ?? "Failed to add");
      } else {
        setAddOpen(false);
        setAddQuery("");
        setAddResults([]);
        router.refresh();
      }
    } finally {
      setAdding(false);
    }
  }

  async function saveOrder(ordered: LinkedAnimeCard[]) {
    await fetch(`/api/links/${linkId}/order`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedAnimeIds: ordered.map((la) => la.anime.id) }),
    });
    router.refresh();
  }

  const showAddResults = addQuery.trim().length >= 2 && (addSearching || addResults.length > 0);
  const libraryResults = addResults.filter((r): r is LibraryResult => r.source === "library");
  const anilistResults = addResults.filter((r): r is AniListResult => r.source === "anilist");

  return (
    <div className="space-y-4">
      {/* Link name */}
      <div className="flex items-center gap-2">
        {editingName ? (
          <>
            <input
              autoFocus
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setEditingName(false);
              }}
              placeholder="Link name (optional)…"
              className="flex-1 text-xl font-bold bg-transparent border-b border-slate-600 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <button onClick={handleSaveName} disabled={savingName} className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50">
              {savingName ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditingName(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white">{displayName}</h2>
            <button
              onClick={() => { setNameValue(linkName ?? ""); setEditingName(true); }}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              title="Edit link name"
            >
              ✎
            </button>
          </>
        )}
      </div>

      {/* Swimlane */}
      <div className="flex flex-wrap gap-4">
        {localAnime.map((la) => {
          const title = la.anime.titleEnglish ?? la.anime.titleRomaji;
          const statusCfg = STATUS_CONFIG[la.anime.airingStatus] ?? { label: la.anime.airingStatus, className: "text-slate-400" };
          const seasonStr = la.anime.season && la.anime.seasonYear
            ? `${la.anime.season.charAt(0) + la.anime.season.slice(1).toLowerCase()} ${la.anime.seasonYear}`
            : la.anime.seasonYear ? String(la.anime.seasonYear) : null;

          return (
            <button
              key={la.id}
              draggable
              onDragStart={(e) => {
                draggingIdRef.current = la.id;
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (draggingIdRef.current === null || draggingIdRef.current === la.id) return;
                if (dragOverIdRef.current === la.id) return;
                dragOverIdRef.current = la.id;
                setLocalAnime((prev) => {
                  const from = prev.findIndex((x) => x.id === draggingIdRef.current);
                  const to = prev.findIndex((x) => x.id === la.id);
                  if (from === -1 || to === -1 || from === to) return prev;
                  const next = [...prev];
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved);
                  return next;
                });
              }}
              onDragEnd={() => {
                draggingIdRef.current = null;
                dragOverIdRef.current = null;
                setLocalAnime((current) => {
                  saveOrder(current);
                  return current;
                });
              }}
              onClick={() => onSelectAnime(la.anime.id)}
              className={`flex flex-col bg-slate-800 rounded-xl overflow-hidden hover:bg-slate-700 transition-colors text-left w-36 flex-shrink-0 group cursor-grab active:cursor-grabbing select-none ${draggingIdRef.current === la.id ? "opacity-40" : ""}`}
            >
              <div className="relative w-36 h-52 bg-slate-700">
                {la.anime.coverImageUrl ? (
                  <Image src={la.anime.coverImageUrl} alt={title} fill className="object-cover" unoptimized />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs text-center px-2">No cover</div>
                )}
              </div>
              <div className="p-2 space-y-1 flex-1">
                <p className="text-xs font-medium text-white leading-tight line-clamp-2 group-hover:text-indigo-300 transition-colors">{title}</p>
                {seasonStr && <p className="text-xs text-slate-500">{seasonStr}</p>}
                <div className="flex items-center justify-between gap-1">
                  {la.anime.totalEpisodes && <span className="text-xs text-slate-400">{la.anime.totalEpisodes} eps</span>}
                  {la.anime.meanScore && <span className="text-xs text-slate-400">{la.anime.meanScore}%</span>}
                </div>
                <p className={`text-xs ${statusCfg.className}`}>{statusCfg.label}</p>
              </div>
            </button>
          );
        })}

        {/* Add card */}
        <button
          onClick={() => { setAddOpen((o) => !o); setAddQuery(""); setAddResults([]); setAddError(null); }}
          className="flex flex-col bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl hover:border-indigo-500 transition-colors w-36 flex-shrink-0 items-center justify-center"
          style={{ minHeight: "264px" }}
          title="Add linked anime"
        >
          <span className="text-3xl text-slate-600">+</span>
          <span className="text-xs text-slate-600 mt-1">Add</span>
        </button>
      </div>

      {/* Inline add search */}
      {addOpen && (
        <div className="space-y-1">
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="Search to add a linked anime…"
              className="flex-1 text-sm bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => { setAddOpen(false); setAddQuery(""); setAddResults([]); }}
              className="text-sm text-slate-500 hover:text-slate-300 px-2"
            >
              ✕
            </button>
          </div>

          {showAddResults && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              {addSearching && addResults.length === 0 && <p className="text-xs text-slate-500 px-3 py-2">Searching…</p>}
              {!addSearching && addResults.length === 0 && <p className="text-xs text-slate-500 px-3 py-2">No results found</p>}

              {libraryResults.length > 0 && (
                <>
                  <p className="text-xs text-slate-500 px-3 pt-2 pb-1 font-medium uppercase tracking-wide">From your library</p>
                  {libraryResults.map((r) => (
                    <button
                      key={`lib-${r.id}`}
                      onClick={() => handleAddSelect(r)}
                      disabled={adding}
                      className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      <span className="text-sm text-slate-200 truncate">{resultTitle(r)}<span className="text-slate-500 text-xs">{resultMeta(r)}</span></span>
                      <span className="text-xs text-emerald-500 flex-shrink-0">In library</span>
                    </button>
                  ))}
                </>
              )}

              {anilistResults.length > 0 && (
                <>
                  <p className="text-xs text-slate-500 px-3 pt-2 pb-1 font-medium uppercase tracking-wide">From AniList</p>
                  {anilistResults.map((r) => (
                    <button
                      key={`al-${r.anilistId}`}
                      onClick={() => handleAddSelect(r)}
                      disabled={adding}
                      className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      <span className="text-sm text-slate-200 truncate">{resultTitle(r)}<span className="text-slate-500 text-xs">{resultMeta(r)}</span></span>
                      <span className="text-xs text-indigo-400 flex-shrink-0">AniList</span>
                    </button>
                  ))}
                </>
              )}

              {adding && <p className="text-xs text-slate-500 px-3 py-2">Adding…</p>}
            </div>
          )}

          {addError && <p className="text-xs text-red-400">{addError}</p>}
        </div>
      )}
    </div>
  );
}
