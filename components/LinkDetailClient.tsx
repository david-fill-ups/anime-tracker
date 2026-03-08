"use client";

import { useState } from "react";
import Image from "next/image";
import type { AiringStatus, UserEntry, Person, Franchise, Anime } from "@/app/generated/prisma";
import LinkOverview, { type LinkedAnimeCard } from "./LinkOverview";
import LinkManager, { type LinkedAnimeSummary } from "./LinkManager";
import AnimeEditForm from "./AnimeEditForm";
import StatusBadge from "./StatusBadge";

type LinkedAnimeDetail = {
  id: number; // LinkedAnime.id
  order: number;
  anime: {
    id: number;
    titleRomaji: string;
    titleEnglish: string | null;
    coverImageUrl: string | null;
    synopsis: string | null;
    totalEpisodes: number | null;
    totalSeasons: number | null;
    episodesPerSeason: string | null;
    meanScore: number | null;
    airingStatus: AiringStatus;
    season: string | null;
    seasonYear: number | null;
    displayFormat: string;
    anilistId: number | null;
    tmdbId: number | null;
    tmdbMediaType: string | null;
    externalUrl: string | null;
    genres: string;
  };
};

type LinkData = {
  id: number;
  name: string | null;
  linkedAnime: LinkedAnimeDetail[];
  userEntry: (UserEntry & { recommender: Person | null; watchContextPerson: Person | null }) | null;
};

type PrimaryAnime = Anime & {
  franchiseEntries: { id: number; franchise: { id: number; name: string } }[];
};

type Props = {
  link: LinkData;
  primaryAnime: PrimaryAnime; // The anime from the URL (may or may not be first in link)
  people: Person[];
  franchises: Franchise[];
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  FINISHED:         { label: "Finished",          className: "bg-green-900/50 text-green-400 border border-green-800" },
  RELEASING:        { label: "Currently Airing",  className: "bg-blue-900/50 text-blue-400 border border-blue-800" },
  HIATUS:           { label: "On Hiatus",         className: "bg-amber-900/50 text-amber-400 border border-amber-800" },
  CANCELLED:        { label: "Cancelled",         className: "bg-red-900/50 text-red-400 border border-red-800" },
  NOT_YET_RELEASED: { label: "Not Yet Released",  className: "bg-slate-700/50 text-slate-400 border border-slate-600" },
};

export default function LinkDetailClient({ link, primaryAnime, people, franchises }: Props) {
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);

  const sorted = [...link.linkedAnime].sort((a, b) => a.order - b.order);
  const isOverview = selectedAnimeId === null;

  // Compute total episodes across all linked anime
  const totalEpisodes = sorted.reduce((s, la) => s + (la.anime.totalEpisodes ?? 0), 0);
  const entry = link.userEntry;

  // Cards for overview swimlane
  const cards: LinkedAnimeCard[] = sorted.map((la) => ({
    id: la.id,
    order: la.order,
    anime: la.anime,
  }));

  // Summary list for LinkManager
  const summaries: LinkedAnimeSummary[] = sorted.map((la) => ({
    id: la.id,
    order: la.order,
    anime: {
      id: la.anime.id,
      titleRomaji: la.anime.titleRomaji,
      titleEnglish: la.anime.titleEnglish,
      anilistId: la.anime.anilistId,
      season: la.anime.season as import("@/app/generated/prisma").Season | null,
      seasonYear: la.anime.seasonYear,
      totalEpisodes: la.anime.totalEpisodes,
      airingStatus: la.anime.airingStatus,
    },
  }));

  // Linked anime seasons for AnimeEditForm episode tracking
  const linkedAnimeSeasonsForForm = sorted.map((la) => ({
    order: la.order,
    anime: {
      id: la.anime.id,
      titleRomaji: la.anime.titleRomaji,
      titleEnglish: la.anime.titleEnglish,
      totalEpisodes: la.anime.totalEpisodes,
      totalSeasons: la.anime.totalSeasons,
      episodesPerSeason: la.anime.episodesPerSeason,
    },
  }));

  // The anime to show in detail view
  const selectedLinked = selectedAnimeId !== null
    ? sorted.find((la) => la.anime.id === selectedAnimeId) ?? null
    : null;

  // Use the primaryAnime's franchiseEntries for both overview and detail header when viewing the page's anime
  const animeForForm = selectedLinked
    ? {
        ...primaryAnime,
        id: selectedLinked.anime.id, // route PATCH calls use this id
      }
    : primaryAnime;

  return (
    <div className="space-y-8">
      {/* Back button in detail mode */}
      {!isOverview && (
        <button
          onClick={() => setSelectedAnimeId(null)}
          className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          ← Back to overview
        </button>
      )}

      {isOverview ? (
        /* ── OVERVIEW ── */
        <div className="space-y-6">
          <LinkOverview
            linkId={link.id}
            linkName={link.name}
            linkedAnime={cards}
            onSelectAnime={setSelectedAnimeId}
          />

          {/* Summary stats */}
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            {entry && <StatusBadge status={entry.watchStatus} />}
            {totalEpisodes > 0 && (
              <span>{totalEpisodes} total episodes</span>
            )}
            <span>{sorted.length} linked</span>
          </div>
        </div>
      ) : (
        /* ── DETAIL VIEW ── */
        selectedLinked && (
          <div className="space-y-6">
            {/* Anime header */}
            <div className="flex gap-6">
              <div className="relative w-32 h-48 flex-shrink-0 rounded-lg overflow-hidden bg-slate-800">
                {selectedLinked.anime.coverImageUrl ? (
                  <Image
                    src={selectedLinked.anime.coverImageUrl}
                    alt={selectedLinked.anime.titleEnglish ?? selectedLinked.anime.titleRomaji}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs text-center px-2">No cover</div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <h2 className="text-2xl font-bold text-white">
                  {selectedLinked.anime.titleEnglish ?? selectedLinked.anime.titleRomaji}
                </h2>
                {selectedLinked.anime.titleEnglish && selectedLinked.anime.titleRomaji !== selectedLinked.anime.titleEnglish && (
                  <p className="text-slate-400 text-sm">{selectedLinked.anime.titleRomaji}</p>
                )}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-slate-500">{selectedLinked.anime.displayFormat}</span>
                  {(() => {
                    const cfg = STATUS_CONFIG[selectedLinked.anime.airingStatus] ?? {
                      label: selectedLinked.anime.airingStatus,
                      className: "bg-slate-800 text-slate-400 border border-slate-700",
                    };
                    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>{cfg.label}</span>;
                  })()}
                  {selectedLinked.anime.season && selectedLinked.anime.seasonYear && (
                    <span className="text-xs text-slate-500">
                      {selectedLinked.anime.season.charAt(0) + selectedLinked.anime.season.slice(1).toLowerCase()} {selectedLinked.anime.seasonYear}
                    </span>
                  )}
                </div>
                {(() => {
                  const genres: string[] = JSON.parse(selectedLinked.anime.genres || "[]");
                  return genres.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {genres.map((g) => (
                        <span key={g} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">{g}</span>
                      ))}
                    </div>
                  ) : null;
                })()}
                {selectedLinked.anime.meanScore && (
                  <p className="text-sm text-slate-400">
                    Community score: <span className="text-white font-medium">{selectedLinked.anime.meanScore}/100</span>
                  </p>
                )}
                {selectedLinked.anime.totalEpisodes && (
                  <p className="text-sm text-slate-400">{selectedLinked.anime.totalEpisodes} episodes</p>
                )}
              </div>
            </div>

            {/* Synopsis */}
            {selectedLinked.anime.synopsis && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Synopsis</h3>
                <p className="text-sm text-slate-400 leading-relaxed line-clamp-6">{selectedLinked.anime.synopsis}</p>
              </div>
            )}

            {/* External links */}
            {(selectedLinked.anime.anilistId || selectedLinked.anime.tmdbId || selectedLinked.anime.externalUrl) && (
              <div className="flex flex-wrap gap-4">
                {selectedLinked.anime.anilistId && (
                  <a
                    href={`https://anilist.co/anime/${selectedLinked.anime.anilistId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    View on AniList ↗
                  </a>
                )}
                {selectedLinked.anime.tmdbId && (
                  <a
                    href={`https://www.themoviedb.org/${selectedLinked.anime.tmdbMediaType ?? "tv"}/${selectedLinked.anime.tmdbId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    View on TMDB ↗
                  </a>
                )}
                {selectedLinked.anime.externalUrl && (
                  <a
                    href={selectedLinked.anime.externalUrl}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    External Link ↗
                  </a>
                )}
              </div>
            )}
          </div>
        )
      )}

      {/* Link management (always visible) */}
      <LinkManager linkId={link.id} linkedAnime={summaries} />

      {/* Your Review (always visible, link-level) */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Your Review</h3>
        <AnimeEditForm
          anime={animeForForm}
          entry={entry}
          people={people}
          franchises={franchises}
          linkedAnime={linkedAnimeSeasonsForForm}
        />
      </div>
    </div>
  );
}
