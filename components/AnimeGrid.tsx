"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import AnimeCard from "./AnimeCard";
import StatusBadge from "./StatusBadge";
import type { Anime, UserEntry, Person, WatchStatus } from "@/app/generated/prisma";

type AnimeWithEntry = Anime & {
  userEntry: (UserEntry & { recommender: Person | null; watchContextPerson: Person | null }) | null;
  franchiseEntries: { franchise: { name: string }; order: number }[];
  animeStudios: { studio: { name: string }; isMainStudio: boolean }[];
};

type ViewMode = "thumbnail" | "list";

function ThumbnailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function AnimeListRow({ anime, onUpdate }: { anime: AnimeWithEntry; onUpdate: () => void }) {
  const entry = anime.userEntry;
  const [loading, setLoading] = useState(false);
  const title = anime.titleEnglish || anime.titleRomaji;
  const mainStudio = anime.animeStudios.find((s) => s.isMainStudio)?.studio.name;
  const franchise = anime.franchiseEntries[0]?.franchise.name;
  const genres: string[] = JSON.parse(anime.genres || "[]");
  const episodeText = entry
    ? `${entry.currentEpisode}${anime.totalEpisodes ? ` / ${anime.totalEpisodes}` : ""}`
    : null;

  async function incrementEpisode() {
    if (!entry) return;
    setLoading(true);
    await fetch(`/api/anime/${anime.id}/episode`, { method: "PATCH" });
    setLoading(false);
    onUpdate();
  }

  async function changeStatus(status: WatchStatus) {
    if (!entry) return;
    setLoading(true);
    await fetch(`/api/anime/${anime.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchStatus: status }),
    });
    setLoading(false);
    onUpdate();
  }

  return (
    <div className={`flex items-center gap-4 bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl px-4 py-3 transition-all ${loading ? "opacity-60" : ""}`}>
      {/* Small thumbnail */}
      <Link href={`/anime/${anime.id}`} className="shrink-0">
        <div className="relative w-10 h-14 rounded overflow-hidden bg-slate-800">
          {anime.coverImageUrl ? (
            <Image
              src={anime.coverImageUrl}
              alt={title}
              fill
              sizes="40px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-[8px] text-center">
              No cover
            </div>
          )}
        </div>
      </Link>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <Link href={`/anime/${anime.id}`} className="block">
          <p className="text-sm font-semibold text-white truncate hover:text-indigo-300 transition-colors">
            {title}
          </p>
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
          {franchise && <span className="text-xs text-slate-500 truncate">{franchise}</span>}
          {mainStudio && <span className="text-xs text-slate-500 truncate">{mainStudio}</span>}
          {genres.slice(0, 2).map((g) => (
            <span key={g} className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
              {g}
            </span>
          ))}
        </div>
      </div>

      {/* Status badge */}
      {entry && (
        <div className="shrink-0 hidden sm:block">
          <StatusBadge status={entry.watchStatus} />
        </div>
      )}

      {/* Score */}
      {entry?.score ? (
        <div className="shrink-0 text-yellow-400 text-sm font-bold w-10 text-right">
          ★ {entry.score}
        </div>
      ) : (
        <div className="shrink-0 w-10" />
      )}

      {/* Episodes */}
      <div className="shrink-0 hidden md:flex items-center gap-2">
        {episodeText && (
          <span className="text-xs text-slate-400 w-16 text-right">Ep {episodeText}</span>
        )}
        {entry?.watchStatus === "WATCHING" && (
          <button
            onClick={incrementEpisode}
            disabled={loading}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors disabled:opacity-50"
          >
            +1
          </button>
        )}
      </div>

      {/* Quick status select */}
      {entry && (
        <div className="shrink-0">
          <select
            value={entry.watchStatus}
            onChange={(e) => changeStatus(e.target.value as WatchStatus)}
            disabled={loading}
            className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
          >
            <option value="WATCHING">Watching</option>
            <option value="COMPLETED">Completed</option>
            <option value="DROPPED">Dropped</option>
            <option value="PLAN_TO_WATCH">Plan to Watch</option>
            <option value="RECOMMENDED">Recommended</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default function AnimeGrid({ animes }: { animes: AnimeWithEntry[] }) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("thumbnail");

  useEffect(() => {
    const saved = localStorage.getItem("animeLibraryView") as ViewMode | null;
    if (saved === "thumbnail" || saved === "list") setView(saved);
  }, []);

  function switchView(v: ViewMode) {
    setView(v);
    localStorage.setItem("animeLibraryView", v);
  }

  if (animes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <p className="text-lg">No anime found</p>
        <p className="text-sm mt-1">Try adjusting your filters or add something new.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex justify-end gap-1">
        <button
          onClick={() => switchView("thumbnail")}
          title="Thumbnail view"
          className={`p-2 rounded-lg transition-colors ${
            view === "thumbnail"
              ? "bg-slate-700 text-white"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
          }`}
        >
          <ThumbnailIcon />
        </button>
        <button
          onClick={() => switchView("list")}
          title="List view"
          className={`p-2 rounded-lg transition-colors ${
            view === "list"
              ? "bg-slate-700 text-white"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
          }`}
        >
          <ListIcon />
        </button>
      </div>

      {/* Thumbnail grid */}
      {view === "thumbnail" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {animes.map((anime) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              onUpdate={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="flex flex-col gap-2">
          {animes.map((anime) => (
            <AnimeListRow
              key={anime.id}
              anime={anime}
              onUpdate={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
