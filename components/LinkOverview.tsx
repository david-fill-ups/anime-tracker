"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AiringStatus } from "@/app/generated/prisma";

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
  FINISHED:         { label: "Finished",         className: "text-green-400" },
  RELEASING:        { label: "Airing",            className: "text-blue-400" },
  HIATUS:           { label: "Hiatus",            className: "text-amber-400" },
  CANCELLED:        { label: "Cancelled",         className: "text-red-400" },
  NOT_YET_RELEASED: { label: "Upcoming",          className: "text-slate-400" },
};

export default function LinkOverview({ linkId, linkName, linkedAnime, onSelectAnime }: LinkOverviewProps) {
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(linkName ?? "");
  const [savingName, setSavingName] = useState(false);

  const sorted = [...linkedAnime].sort((a, b) => a.order - b.order);
  const displayName = linkName ?? (sorted[0]?.anime.titleEnglish ?? sorted[0]?.anime.titleRomaji ?? "");

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
            <button
              onClick={handleSaveName}
              disabled={savingName}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
            >
              {savingName ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditingName(false)} className="text-xs text-slate-500 hover:text-slate-300">
              Cancel
            </button>
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
        {sorted.map((la) => {
          const title = la.anime.titleEnglish ?? la.anime.titleRomaji;
          const statusCfg = STATUS_CONFIG[la.anime.airingStatus] ?? { label: la.anime.airingStatus, className: "text-slate-400" };
          const seasonStr = la.anime.season && la.anime.seasonYear
            ? `${la.anime.season.charAt(0) + la.anime.season.slice(1).toLowerCase()} ${la.anime.seasonYear}`
            : la.anime.seasonYear
            ? String(la.anime.seasonYear)
            : null;

          return (
            <button
              key={la.id}
              onClick={() => onSelectAnime(la.anime.id)}
              className="flex flex-col bg-slate-800 rounded-xl overflow-hidden hover:bg-slate-700 transition-colors text-left w-36 flex-shrink-0 group"
            >
              {/* Cover */}
              <div className="relative w-36 h-52 bg-slate-700">
                {la.anime.coverImageUrl ? (
                  <Image
                    src={la.anime.coverImageUrl}
                    alt={title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs text-center px-2">
                    No cover
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2 space-y-1 flex-1">
                <p className="text-xs font-medium text-white leading-tight line-clamp-2 group-hover:text-indigo-300 transition-colors">
                  {title}
                </p>
                {seasonStr && (
                  <p className="text-xs text-slate-500">{seasonStr}</p>
                )}
                <div className="flex items-center justify-between gap-1">
                  {la.anime.totalEpisodes && (
                    <span className="text-xs text-slate-400">{la.anime.totalEpisodes} eps</span>
                  )}
                  {la.anime.meanScore && (
                    <span className="text-xs text-slate-400">{la.anime.meanScore}%</span>
                  )}
                </div>
                <p className={`text-xs ${statusCfg.className}`}>{statusCfg.label}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
