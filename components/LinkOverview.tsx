"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { AiringStatus, Season } from "@/app/generated/prisma";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
    anilistId: number | null;
    startYear: number | null;
    startMonth: number | null;
    startDay: number | null;
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

// Shared card visual — used by both SortableAnimeCard and DragOverlay
function AnimeCardContent({ la, dimmed }: { la: LinkedAnimeCard; dimmed?: boolean }) {
  const title = la.anime.titleEnglish ?? la.anime.titleRomaji;
  const statusCfg = STATUS_CONFIG[la.anime.airingStatus] ?? { label: la.anime.airingStatus, className: "text-slate-400" };
  const seasonStr = la.anime.season && la.anime.seasonYear
    ? `${la.anime.season.charAt(0) + la.anime.season.slice(1).toLowerCase()} ${la.anime.seasonYear}`
    : la.anime.seasonYear ? String(la.anime.seasonYear) : null;

  return (
    <div className={`flex flex-col bg-slate-800 rounded-xl overflow-hidden text-left w-48 ${dimmed ? "opacity-40" : ""}`}>
      <div className="relative w-48 h-52 bg-slate-700">
        {la.anime.coverImageUrl ? (
          <Image src={la.anime.coverImageUrl} alt={title} fill className="object-cover" unoptimized />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs text-center px-2">No cover</div>
        )}
      </div>
      <div className="p-2 space-y-1 flex-1">
        <p title={title} className="text-xs font-medium text-white leading-tight line-clamp-3">{title}</p>
        {(() => {
          if (la.anime.airingStatus === "NOT_YET_RELEASED" && la.anime.startMonth) {
            const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const m = months[la.anime.startMonth - 1];
            const y = la.anime.startYear ?? la.anime.seasonYear;
            const label = la.anime.startDay ? `${m} ${la.anime.startDay}, ${y}` : `${m} ${y}`;
            return <p className="text-xs text-slate-500">{label}</p>;
          }
          return seasonStr ? <p className="text-xs text-slate-500">{seasonStr}</p> : null;
        })()}
        <div className="flex items-center justify-between gap-1">
          {la.anime.totalEpisodes && <span className="text-xs text-slate-400">{la.anime.totalEpisodes} eps</span>}
          {la.anime.meanScore && <span className="text-xs text-slate-400">{la.anime.meanScore}%</span>}
        </div>
        <p className={`text-xs ${statusCfg.className}`}>{statusCfg.label}</p>
      </div>
    </div>
  );
}

type SortableAnimeCardProps = {
  la: LinkedAnimeCard;
  isDraggingOverlay?: boolean;
  removingAnimeId: number | null;
  onSelect: (animeId: number) => void;
  onRemove: (animeId: number) => void;
};

function SortableAnimeCard({ la, removingAnimeId, onSelect, onRemove }: SortableAnimeCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: la.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative flex-shrink-0 group">
      <button
        {...attributes}
        {...listeners}
        onClick={() => onSelect(la.anime.id)}
        className={`cursor-grab active:cursor-grabbing select-none hover:brightness-110 transition-[filter] rounded-xl ${removingAnimeId === la.anime.id ? "opacity-40" : ""}`}
        suppressHydrationWarning
      >
        <AnimeCardContent la={la} dimmed={isDragging} />
      </button>
      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(la.anime.id); }}
        disabled={removingAnimeId === la.anime.id}
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
        title="Remove anime"
      >
        ✕
      </button>
    </div>
  );
}

export default function LinkOverview({ linkId, linkName, linkedAnime, onSelectAnime }: LinkOverviewProps) {
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(linkName ?? "");
  const [savingName, setSavingName] = useState(false);

  // Local ordered list for optimistic DnD reordering
  const [localAnime, setLocalAnime] = useState(() => [...linkedAnime].sort((a, b) => a.order - b.order));
  const [activeId, setActiveId] = useState<number | null>(null);
  const preDropOrderRef = useRef<LinkedAnimeCard[]>(localAnime);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Sync from props when server data changes (e.g. after an anime is removed)
  const animeKey = linkedAnime.map((la) => `${la.id}:${la.order}`).join(",");
  useEffect(() => {
    setLocalAnime([...linkedAnime].sort((a, b) => a.order - b.order));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeKey]);

  const displayName = linkName ?? (localAnime[0]?.anime.titleEnglish ?? localAnime[0]?.anime.titleRomaji ?? "");

  // Remove-anime state
  const [removingAnimeId, setRemovingAnimeId] = useState<number | null>(null);

  async function handleRemoveAnime(animeId: number) {
    if (!confirm("Remove this anime from your library completely?")) return;
    const isOnlyAnime = localAnime.length <= 1;
    setRemovingAnimeId(animeId);
    try {
      const res = await fetch(`/api/links/${linkId}/anime/${animeId}?deleteAnime=true`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to remove anime");
        return;
      }
      if (isOnlyAnime) {
        router.push("/");
      } else {
        const remaining = localAnime.filter((la) => la.anime.id !== animeId);
        router.push(`/anime/${remaining[0].anime.id}`);
      }
    } finally {
      setRemovingAnimeId(null);
    }
  }

  // Add-anime state
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<SearchResult[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualEpisodes, setManualEpisodes] = useState("");

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

      const linkedAnimeIds = new Set(localAnime.map((la) => la.anime.id));
      const libraryResults: LibraryResult[] = lib
        .map((r) => ({ ...r, source: "library" as const }))
        .filter((r) => !linkedAnimeIds.has(r.id));
      // Exclude AniList results already linked (library search excludes them, so libAnilistIds
      // won't contain them — use the linked anime prop directly instead).
      const linkedAnilistIds = new Set(linkedAnime.map((la) => la.anime.anilistId).filter(Boolean));
      const libAnilistIds = new Set(libraryResults.map((r) => r.anilistId).filter(Boolean));
      const anilistResults: AniListResult[] = al
        .filter((r) => !libAnilistIds.has(r.id) && !linkedAnilistIds.has(r.id))
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

  async function handleManualAdd() {
    const title = manualTitle.trim();
    if (!title) return;
    const eps = manualEpisodes ? parseInt(manualEpisodes, 10) : undefined;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/links/${linkId}/anime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual: { title, ...(eps && eps > 0 ? { totalEpisodes: eps } : {}) } }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        setAddError(msg ?? "Failed to add");
      } else {
        setAddOpen(false);
        setAddQuery("");
        setAddResults([]);
        setShowManualForm(false);
        setManualTitle("");
        setManualEpisodes("");
        router.refresh();
      }
    } finally {
      setAdding(false);
    }
  }

  async function saveOrder(ordered: LinkedAnimeCard[]) {
    const res = await fetch(`/api/links/${linkId}/order`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedAnimeIds: ordered.map((la) => la.anime.id) }),
    });
    if (!res.ok) {
      setLocalAnime(preDropOrderRef.current);
    } else {
      router.refresh();
    }
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as number);
    preDropOrderRef.current = localAnime;
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = localAnime.findIndex((la) => la.id === active.id);
    const newIndex = localAnime.findIndex((la) => la.id === over.id);
    const reordered = arrayMove(localAnime, oldIndex, newIndex);
    setLocalAnime(reordered);
    saveOrder(reordered);
  }

  const activeAnime = activeId ? localAnime.find((la) => la.id === activeId) ?? null : null;

  const showAddSearch = addQuery.trim().length >= 2;
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={localAnime.map((la) => la.id)} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-4">
            {localAnime.map((la) => (
              <SortableAnimeCard
                key={la.id}
                la={la}
                removingAnimeId={removingAnimeId}
                onSelect={onSelectAnime}
                onRemove={handleRemoveAnime}
              />
            ))}

            {/* Add card */}
            <button
              onClick={() => { setAddOpen((o) => !o); setAddQuery(""); setAddResults([]); setAddError(null); }}
              className="flex flex-col bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl hover:border-indigo-500 transition-colors w-48 flex-shrink-0 items-center justify-center"
              style={{ minHeight: "264px" }}
              title="Add linked anime"
            >
              <span className="text-3xl text-slate-600">+</span>
              <span className="text-xs text-slate-600 mt-1">Add</span>
            </button>
          </div>
        </SortableContext>

        <DragOverlay>
          {activeAnime ? (
            <div className="rotate-2 shadow-2xl shadow-black/50 rounded-xl">
              <AnimeCardContent la={activeAnime} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
              onClick={() => { setAddOpen(false); setAddQuery(""); setAddResults([]); setShowManualForm(false); setManualTitle(""); setManualEpisodes(""); }}
              className="text-sm text-slate-500 hover:text-slate-300 px-2"
            >
              ✕
            </button>
          </div>

          {showAddSearch && addResults.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              {addSearching && <p className="text-xs text-slate-500 px-3 py-2">Searching…</p>}

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

          {showAddSearch && !showManualForm && (
            <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
              <span className="text-xs text-slate-500">
                {addSearching && addResults.length === 0 ? "Searching…" : addResults.length === 0 ? "No results found." : "Not what you're looking for?"}
              </span>
              <button
                onClick={() => { setManualTitle(addQuery.trim()); setShowManualForm(true); }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                + Add manually
              </button>
            </div>
          )}

          {showAddSearch && showManualForm && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-3 space-y-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Manual Entry</p>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Title"
                className="w-full text-sm bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="number"
                value={manualEpisodes}
                onChange={(e) => setManualEpisodes(e.target.value)}
                placeholder="Episodes (optional)"
                min={1}
                className="w-full text-sm bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleManualAdd}
                  disabled={!manualTitle.trim() || adding}
                  className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded px-3 py-1 transition-colors"
                >
                  {adding ? "Adding…" : "Add"}
                </button>
                <button
                  onClick={() => setShowManualForm(false)}
                  className="text-sm text-slate-500 hover:text-slate-300 px-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {addError && <p className="text-xs text-red-400">{addError}</p>}
        </div>
      )}
    </div>
  );
}
