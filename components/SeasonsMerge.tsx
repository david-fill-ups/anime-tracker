"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AiringStatus, Season } from "@/app/generated/prisma";

export interface MergedAnimeSeason {
  id: number;
  titleRomaji: string;
  titleEnglish: string | null;
  anilistId: number | null;
  season: Season | null;
  seasonYear: number | null;
  totalEpisodes: number | null;
  airingStatus: AiringStatus;
}

const STATUS_LABELS: Partial<Record<AiringStatus, string>> = {
  FINISHED: "Finished",
  RELEASING: "Airing",
  NOT_YET_RELEASED: "Upcoming",
  HIATUS: "Hiatus",
  CANCELLED: "Cancelled",
};

export default function SeasonsMerge({
  animeId,
  mergedAnimes,
}: {
  animeId: number;
  mergedAnimes: MergedAnimeSeason[];
}) {
  const router = useRouter();
  const [anilistIdInput, setAnilistIdInput] = useState("");
  const [merging, setMerging] = useState(false);
  const [unmerging, setUnmerging] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMerge() {
    const anilistId = parseInt(anilistIdInput.trim(), 10);
    if (!anilistId) return;
    setMerging(true);
    setError(null);
    try {
      const res = await fetch(`/api/anime/${animeId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anilistId }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? "Failed to merge");
      } else {
        setAnilistIdInput("");
        router.refresh();
      }
    } finally {
      setMerging(false);
    }
  }

  async function handleUnmerge(secondaryId: number) {
    setUnmerging(secondaryId);
    setError(null);
    try {
      const res = await fetch(`/api/anime/${animeId}/merge/${secondaryId}`, { method: "DELETE" });
      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? "Failed to unmerge");
      } else {
        router.refresh();
      }
    } finally {
      setUnmerging(null);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-300">Seasons</h3>

      {mergedAnimes.length > 0 && (
        <div className="space-y-1">
          {mergedAnimes.map((s) => {
            const title = s.titleEnglish ?? s.titleRomaji;
            const yearStr = s.seasonYear ? ` · ${s.season ? s.season.charAt(0) + s.season.slice(1).toLowerCase() + " " : ""}${s.seasonYear}` : "";
            const epsStr = s.totalEpisodes ? ` · ${s.totalEpisodes} eps` : "";
            const statusStr = STATUS_LABELS[s.airingStatus] ?? s.airingStatus;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 bg-slate-800 rounded-lg px-3 py-2 text-sm"
              >
                <span className="text-slate-300 flex-1 truncate">
                  {title}
                  <span className="text-slate-500">{yearStr}{epsStr}</span>
                  <span className="ml-2 text-xs text-slate-500">{statusStr}</span>
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {s.anilistId && (
                    <a
                      href={`https://anilist.co/anime/${s.anilistId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      AniList ↗
                    </a>
                  )}
                  <button
                    onClick={() => handleUnmerge(s.id)}
                    disabled={unmerging === s.id}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {unmerging === s.id ? "…" : "Unmerge"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="number"
          value={anilistIdInput}
          onChange={(e) => setAnilistIdInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleMerge()}
          placeholder="AniList ID"
          className="flex-1 text-sm bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleMerge}
          disabled={merging || !anilistIdInput.trim()}
          className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded transition-colors disabled:opacity-50"
        >
          {merging ? "Merging…" : "+ Merge Season"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
