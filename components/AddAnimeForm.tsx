"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { AniListAnime } from "@/lib/anilist";
import type { Person, Franchise } from "@/app/generated/prisma";

type Mode = "search" | "manual";

const WATCH_STATUSES = [
  { value: "PLAN_TO_WATCH", label: "Plan to Watch" },
  { value: "WATCHING", label: "Watching" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DROPPED", label: "Dropped" },
];

export default function AddAnimeForm({
  people,
  franchises,
  returnTo = "/library",
  defaultStatus,
}: {
  people: Person[];
  franchises: Franchise[];
  returnTo?: string;
  defaultStatus?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AniListAnime[]>([]);
  const [selected, setSelected] = useState<AniListAnime | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Franchise
  const [franchiseId, setFranchiseId] = useState("");
  const [franchiseEntryType, setFranchiseEntryType] = useState("MAIN");

  // User entry fields
  const [watchStatus, setWatchStatus] = useState(defaultStatus ?? "PLAN_TO_WATCH");
  const [watchContext, setWatchContext] = useState("");
  const [watchPartyWith, setWatchPartyWith] = useState("");
  const [discoveryType, setDiscoveryTypeState] = useState("");
  const [recommenderId, setRecommenderId] = useState("");
  const [discoverySource, setDiscoverySource] = useState("");
  const [sourceSuggestions, setSourceSuggestions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/discovery-sources")
      .then((r) => r.json())
      .then((d) => setSourceSuggestions(d.sources ?? []));
  }, []);

  function setDiscoveryType(type: string) {
    setDiscoveryTypeState(type);
    if (type !== "PERSONAL") setRecommenderId("");
    if (type !== "PLATFORM" && type !== "OTHER") setDiscoverySource("");
  }

  // Manual fields
  const [manual, setManual] = useState({
    titleRomaji: "",
    titleEnglish: "",
    totalEpisodes: "",
    airingStatus: "FINISHED",
    displayFormat: "SERIES",
    synopsis: "",
    genres: "",
  });

  const search = useCallback(async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setResults([]);
    const res = await fetch(`/api/anilist/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data);
    setSearching(false);
  }, [query]);

  async function submit() {
    setSubmitting(true);
    setError("");

    const entryFields = {
      watchStatus,
      watchContext: watchContext || null,
      watchPartyWith: watchContext === "WATCH_PARTY" ? watchPartyWith : null,
      recommenderId: discoveryType === "PERSONAL" && recommenderId ? Number(recommenderId) : null,
      discoveryType: discoveryType || null,
      discoverySource: (discoveryType === "PLATFORM" || discoveryType === "OTHER") ? discoverySource || null : null,
    };

    let body: Record<string, unknown>;
    if (mode === "search" && selected) {
      body = { source: "ANILIST", anilistId: selected.id, ...entryFields };
    } else {
      if (!manual.titleRomaji) {
        setError("Title is required.");
        setSubmitting(false);
        return;
      }
      body = {
        source: "MANUAL",
        ...manual,
        totalEpisodes: manual.totalEpisodes ? Number(manual.totalEpisodes) : null,
        genres: manual.genres.split(",").map((g) => g.trim()).filter(Boolean),
        ...entryFields,
      };
    }

    const res = await fetch("/api/anime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong.");
      setSubmitting(false);
      return;
    }

    const anime = await res.json();

    if (franchiseId && anime?.id) {
      await fetch(`/api/franchises/${franchiseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId: anime.id, entryType: franchiseEntryType }),
      });
    }

    router.push(returnTo);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex rounded-lg overflow-hidden border border-slate-700">
        {(["search", "manual"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setSelected(null); setResults([]); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === m
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {m === "search" ? "Search AniList" : "Manual Entry"}
          </button>
        ))}
      </div>

      {/* AniList search */}
      {mode === "search" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search for an anime..."
              className="flex-1 bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={search}
              disabled={searching}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {searching ? "..." : "Search"}
            </button>
          </div>

          {results.length > 0 && !selected && (
            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="flex gap-3 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-left transition-colors"
                >
                  <div className="relative w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-slate-700">
                    {r.coverImage?.large && (
                      <Image src={r.coverImage.large} alt={r.title.romaji} fill className="object-cover" unoptimized />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white line-clamp-2">
                      {r.title.english || r.title.romaji}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {r.seasonYear} · {r.episodes ? `${r.episodes} eps` : "?"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="flex gap-4 p-3 bg-slate-800 rounded-lg border border-indigo-500/50">
              <div className="relative w-14 h-20 flex-shrink-0 rounded overflow-hidden bg-slate-700">
                <Image src={selected.coverImage.large} alt={selected.title.romaji} fill className="object-cover" unoptimized />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{selected.title.english || selected.title.romaji}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selected.seasonYear} · {selected.episodes ? `${selected.episodes} eps` : "ongoing"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{selected.genres.slice(0, 3).join(", ")}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 text-sm self-start">✕</button>
            </div>
          )}
        </div>
      )}

      {/* Manual entry */}
      {mode === "manual" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Title (Romaji / Main) *</label>
            <input
              value={manual.titleRomaji}
              onChange={(e) => setManual({ ...manual, titleRomaji: e.target.value })}
              className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Title (English)</label>
            <input
              value={manual.titleEnglish}
              onChange={(e) => setManual({ ...manual, titleEnglish: e.target.value })}
              className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Total Episodes</label>
              <input
                type="number"
                value={manual.totalEpisodes}
                onChange={(e) => setManual({ ...manual, totalEpisodes: e.target.value })}
                className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Format</label>
              <select
                value={manual.displayFormat}
                onChange={(e) => setManual({ ...manual, displayFormat: e.target.value })}
                className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="SERIES">Series</option>
                <option value="MOVIE">Movie</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Airing Status</label>
            <select
              value={manual.airingStatus}
              onChange={(e) => setManual({ ...manual, airingStatus: e.target.value })}
              className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="FINISHED">Finished</option>
              <option value="RELEASING">Releasing</option>
              <option value="HIATUS">Hiatus</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NOT_YET_RELEASED">Not Yet Released</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Genres (comma-separated)</label>
            <input
              value={manual.genres}
              onChange={(e) => setManual({ ...manual, genres: e.target.value })}
              placeholder="Action, Adventure, Fantasy"
              className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Synopsis</label>
            <textarea
              value={manual.synopsis}
              onChange={(e) => setManual({ ...manual, synopsis: e.target.value })}
              rows={3}
              className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>
      )}

      {/* Entry fields (shared) */}
      <div className="space-y-3 border-t border-slate-800 pt-4">
        <h3 className="text-sm font-medium text-slate-300">Your Entry</h3>

        <div className={`grid gap-3 ${defaultStatus ? "grid-cols-1" : "grid-cols-2"}`}>
          {!defaultStatus && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select
                value={watchStatus}
                onChange={(e) => setWatchStatus(e.target.value)}
                className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                {WATCH_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Watch Context</label>
            <select
              value={watchContext}
              onChange={(e) => setWatchContext(e.target.value)}
              className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Not set —</option>
              <option value="SOLO">Solo</option>
              <option value="WATCH_PARTY">Watch Party</option>
            </select>
          </div>
        </div>

        {watchContext === "WATCH_PARTY" && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Watching with</label>
            <input
              value={watchPartyWith}
              onChange={(e) => setWatchPartyWith(e.target.value)}
              placeholder="e.g. brother"
              className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1">How did you find this?</label>
          <div className="flex flex-wrap gap-1 mb-2">
            {([
              { value: "", label: "—" },
              { value: "PERSONAL", label: "Personal" },
              { value: "PLATFORM", label: "Platform" },
              { value: "OTHER", label: "Other" },
              { value: "UNKNOWN", label: "Don't remember" },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDiscoveryType(value)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  discoveryType === value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {discoveryType === "PERSONAL" && (
            <select
              value={recommenderId}
              onChange={(e) => setRecommenderId(e.target.value)}
              className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Select person —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {discoveryType === "PLATFORM" && (
            <>
              <input
                list="add-discovery-source-suggestions"
                value={discoverySource}
                onChange={(e) => setDiscoverySource(e.target.value)}
                placeholder="e.g. Netflix, TikTok..."
                className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
              <datalist id="add-discovery-source-suggestions">
                {sourceSuggestions.map((s) => <option key={s} value={s} />)}
              </datalist>
            </>
          )}
          {discoveryType === "OTHER" && (
            <input
              value={discoverySource}
              onChange={(e) => setDiscoverySource(e.target.value)}
              placeholder="Describe..."
              className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          )}
        </div>
      </div>

      {/* Franchise (optional) */}
      {franchises.length > 0 && (
        <div className="space-y-2 border-t border-slate-800 pt-4">
          <h3 className="text-sm font-medium text-slate-300">Franchise</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Add to Franchise</label>
              <select
                value={franchiseId}
                onChange={(e) => setFranchiseId(e.target.value)}
                className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">— None —</option>
                {franchises.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            {franchiseId && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Entry Type</label>
                <select
                  value={franchiseEntryType}
                  onChange={(e) => setFranchiseEntryType(e.target.value)}
                  className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="MAIN">Main</option>
                  <option value="SIDE_STORY">Side Story</option>
                  <option value="MOVIE">Movie</option>
                  <option value="OVA">OVA</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-md transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting || (mode === "search" && !selected)}
          className="flex-1 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add to Library"}
        </button>
      </div>
    </div>
  );
}
