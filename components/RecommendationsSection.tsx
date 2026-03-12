"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Anime, UserEntry } from "@/app/generated/prisma";

export type RecommendationItem = {
  anime: Anime & {
    userEntry: UserEntry | null;
    franchiseEntries: { franchise: { name: string }; order: number }[];
    animeStudios: { studio: { name: string }; isMainStudio: boolean }[];
  };
  franchise: { id: number; name: string };
  franchiseOrder: number;
  isNotInterested: boolean;
  isNewSeason: boolean;
  suggestedLinkId: number | null;
  suggestedLinkName: string | null;
};

function RecommendationCard({
  item,
  onAction,
}: {
  item: RecommendationItem;
  onAction: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { anime, franchise, franchiseOrder, isNewSeason, suggestedLinkId, suggestedLinkName } = item;
  const title = anime.titleEnglish || anime.titleRomaji;
  const genres: string[] = JSON.parse(anime.genres || "[]");
  const totalEntries = anime.franchiseEntries.length;

  async function addToLink() {
    setLoading(true);
    await fetch(`/api/links/${suggestedLinkId}/anime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId: anime.id }),
    });
    setLoading(false);
    onAction();
  }

  async function markInterested() {
    setLoading(true);
    await fetch(`/api/anime/${anime.id}/entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchStatus: "PLAN_TO_WATCH" }),
    });
    setLoading(false);
    onAction();
  }

  async function markNotInterested() {
    setLoading(true);
    await fetch(`/api/anime/${anime.id}/entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchStatus: "NOT_INTERESTED" }),
    });
    setLoading(false);
    onAction();
  }

  async function undo() {
    setLoading(true);
    await fetch(`/api/anime/${anime.id}/entry`, { method: "DELETE" });
    setLoading(false);
    onAction();
  }

  if (item.isNotInterested) {
    return (
      <div className={`flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 opacity-60 ${loading ? "pointer-events-none" : ""}`}>
        <div className="relative w-8 h-11 rounded overflow-hidden bg-slate-800 shrink-0">
          {anime.coverImageUrl && (
            <Image src={anime.coverImageUrl} alt={title} fill sizes="32px" className="object-cover" unoptimized />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/anime/${anime.id}`} className="text-sm text-slate-400 hover:text-white transition-colors truncate block">
            {title}
          </Link>
          <p className="text-xs text-slate-600">{franchise.name}</p>
        </div>
        <button
          onClick={undo}
          disabled={loading}
          className="shrink-0 text-xs text-slate-500 hover:text-indigo-400 border border-slate-700 hover:border-indigo-600 px-3 py-1 rounded-md transition-colors disabled:opacity-40"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className={`group bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl overflow-hidden transition-all ${loading ? "opacity-60 pointer-events-none" : ""}`}>
      <Link href={`/anime/${anime.id}`} className="relative aspect-[2/3] bg-slate-800 block">
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
        {isNewSeason && (
          <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded">
            New Season?
          </div>
        )}
        {anime.meanScore && (
          <div className="absolute top-2 right-2 bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded">
            ★ {(anime.meanScore / 10).toFixed(1)}
          </div>
        )}
      </Link>

      <div className="p-3 space-y-2">
        <Link href={`/anime/${anime.id}`} className="block">
          <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2 hover:text-indigo-300 transition-colors">
            {title}
          </h3>
        </Link>

        <p className="text-xs text-indigo-400/80">
          {franchise.name}
          {totalEntries > 1 && (
            <span className="text-slate-500"> · #{franchiseOrder}</span>
          )}
        </p>

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {genres.slice(0, 2).map((g) => (
              <span key={g} className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                {g}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex gap-2">
            <button
              onClick={suggestedLinkId ? addToLink : markInterested}
              disabled={loading}
              className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50"
            >
              {suggestedLinkId ? "Continue Series" : "Interested"}
            </button>
            <button
              onClick={markNotInterested}
              disabled={loading}
              className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-2 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50"
            >
              Not Interested
            </button>
          </div>
          {suggestedLinkId && (
            <button
              onClick={markInterested}
              disabled={loading}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors text-left disabled:opacity-50"
            >
              or add standalone
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RecommendationsSection({ items }: { items: RecommendationItem[] }) {
  const router = useRouter();
  const [showNotInterested, setShowNotInterested] = useState(false);

  const active = items.filter((i) => !i.isNotInterested);
  const hidden = items.filter((i) => i.isNotInterested);

  function refresh() {
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Recommendations
          {active.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-500">{active.length}</span>
          )}
        </h3>
      </div>

      {active.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">
          No recommendations yet — add some franchises to get started.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {active.map((item) => (
            <RecommendationCard key={item.anime.id} item={item} onAction={refresh} />
          ))}
        </div>
      )}

      {hidden.length > 0 && (
        <div className="pt-2 space-y-2">
          <button
            onClick={() => setShowNotInterested((v) => !v)}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showNotInterested ? "▾" : "▸"} Not interested ({hidden.length})
          </button>
          {showNotInterested && (
            <div className="flex flex-col gap-2">
              {hidden.map((item) => (
                <RecommendationCard key={item.anime.id} item={item} onAction={refresh} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
