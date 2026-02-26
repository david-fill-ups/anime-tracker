"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import StatusBadge from "./StatusBadge";
import type { Anime, UserEntry, WatchStatus } from "@/app/generated/prisma";

type AnimeWithEntry = Anime & {
  userEntry: UserEntry & { recommender: { name: string } | null } | null;
  franchiseEntries: { franchise: { name: string }; order: number }[];
  animeStudios: { studio: { name: string }; isMainStudio: boolean }[];
};

export default function AnimeCard({ anime, onUpdate }: {
  anime: AnimeWithEntry;
  onUpdate: () => void;
}) {
  const entry = anime.userEntry;
  const [loading, setLoading] = useState(false);

  const mainStudio = anime.animeStudios.find((s) => s.isMainStudio)?.studio.name;
  const franchise = anime.franchiseEntries[0]?.franchise.name;
  const genres: string[] = JSON.parse(anime.genres || "[]");

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

  const episodeText = entry
    ? `${entry.currentEpisode}${anime.totalEpisodes ? ` / ${anime.totalEpisodes}` : ""}`
    : null;

  const title = anime.titleEnglish || anime.titleRomaji;

  return (
    <div className={`group relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-all ${loading ? "opacity-60" : ""}`}>
      {/* Cover image */}
      <div className="relative aspect-[2/3] bg-slate-800">
        {anime.coverImageUrl ? (
          <Image
            src={anime.coverImageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 50vw, 200px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm text-center px-2">
            No cover
          </div>
        )}
        {/* Status badge overlay */}
        {entry && (
          <div className="absolute top-2 left-2">
            <StatusBadge status={entry.watchStatus} />
          </div>
        )}
        {/* Score overlay */}
        {entry?.score && (
          <div className="absolute top-2 right-2 bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded">
            ★ {entry.score}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <Link href={`/anime/${anime.id}`} className="block">
          <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2 hover:text-indigo-300 transition-colors">
            {title}
          </h3>
        </Link>

        {franchise && (
          <p className="text-xs text-slate-500 truncate">{franchise}</p>
        )}

        {mainStudio && (
          <p className="text-xs text-slate-500 truncate">{mainStudio}</p>
        )}

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {genres.slice(0, 2).map((g) => (
              <span key={g} className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Episode progress + increment */}
        {entry && entry.watchStatus === "WATCHING" && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">Ep {episodeText}</span>
            <button
              onClick={incrementEpisode}
              disabled={loading}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors disabled:opacity-50"
            >
              +1
            </button>
          </div>
        )}

        {entry && entry.watchStatus !== "WATCHING" && episodeText && (
          <p className="text-xs text-slate-500">Ep {episodeText}</p>
        )}

        {/* Watch context */}
        {entry?.watchContext === "WATCH_PARTY" && entry.watchPartyWith && (
          <p className="text-xs text-slate-500">w/ {entry.watchPartyWith}</p>
        )}

        {/* Quick status change */}
        {entry && (
          <div className="pt-1">
            <select
              value={entry.watchStatus}
              onChange={(e) => changeStatus(e.target.value as WatchStatus)}
              disabled={loading}
              className="w-full text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
            >
              <option value="WATCHING">Watching</option>
              <option value="COMPLETED">Completed</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="DROPPED">Dropped</option>
              <option value="PLAN_TO_WATCH">Plan to Watch</option>
              <option value="RECOMMENDED">Recommended</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
