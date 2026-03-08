"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import type { WatchStatus } from "@/app/generated/prisma";

// ── Star rating (same design as AnimeEditForm) ────────────────────────────────

const STAR_PATH =
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-400 w-8 shrink-0">{label}</span>
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const full = display >= star;
          const half = !full && display >= star - 0.5;
          return (
            <div key={star} className="relative w-8 h-8">
              <svg viewBox="0 0 24 24" className="w-8 h-8 pointer-events-none">
                <path d={STAR_PATH} fill="#475569" />
                {full && <path d={STAR_PATH} fill="#facc15" />}
                {half && (
                  <path d={STAR_PATH} fill="#facc15" style={{ clipPath: "inset(0 50% 0 0)" }} />
                )}
              </svg>
              <div
                className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(star - 0.5)}
                onClick={() => onChange(value === star - 0.5 ? 0 : star - 0.5)}
              />
              <div
                className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(star)}
                onClick={() => onChange(value === star ? 0 : star)}
              />
            </div>
          );
        })}
        <span className="ml-2 text-sm text-slate-400 min-w-[3rem]">
          {value > 0 ? `${value} / 5` : "—"}
        </span>
        {value > 0 && (
          <button
            type="button"
            onClick={() => onChange(0)}
            className="ml-1 text-slate-600 hover:text-slate-400 transition-colors"
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tag select (search + add as chips) ────────────────────────────────────────

function TagSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = options.filter(
    (o) => o.toLowerCase().includes(query.toLowerCase()) && !selected.includes(o)
  );

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {selected.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1 bg-indigo-900/50 border border-indigo-700 text-indigo-300 text-sm px-2.5 py-0.5 rounded-full"
            >
              {s}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== s))}
                className="text-indigo-400 hover:text-white transition-colors leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-md max-h-48 overflow-y-auto shadow-xl">
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange([...selected, option]);
                  setQuery("");
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const WATCH_STATUSES: { value: WatchStatus; label: string }[] = [
  { value: "WATCHING", label: "Watching" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DROPPED", label: "Dropped" },
];

export default function LibraryFiltersForm({
  franchises,
  people,
  genres,
  studios,
  initialParams,
}: {
  franchises: { id: number; name: string }[];
  people: { id: number; name: string }[];
  genres: string[];
  studios: string[];
  initialParams: Record<string, string>;
}) {
  const router = useRouter();

  const [franchise, setFranchise] = useState(initialParams.franchise || "");
  const [format, setFormat] = useState(initialParams.format || "");
  const [context, setContext] = useState(initialParams.context || "");
  const [watchStatus, setWatchStatus] = useState(initialParams.status || "");
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    initialParams.genre ? initialParams.genre.split(",").filter(Boolean) : []
  );
  const [selectedStudios, setSelectedStudios] = useState<string[]>(
    initialParams.studio ? initialParams.studio.split(",").filter(Boolean) : []
  );
  const [minScore, setMinScore] = useState(
    initialParams.minScore ? parseFloat(initialParams.minScore) : 0
  );
  const [maxScore, setMaxScore] = useState(
    initialParams.maxScore ? parseFloat(initialParams.maxScore) : 0
  );

  const applyFilters = () => {
    const params = new URLSearchParams();
    // Preserve non-filter params from library
    if (initialParams.sort) params.set("sort", initialParams.sort);
    if (initialParams.search) params.set("search", initialParams.search);
    if (initialParams.verified) params.set("verified", initialParams.verified);
    // Apply filter values
    if (watchStatus) params.set("status", watchStatus);
    if (franchise) params.set("franchise", franchise);
    if (format) params.set("format", format);
    if (context) params.set("context", context);
    if (selectedGenres.length > 0) params.set("genre", selectedGenres.join(","));
    if (selectedStudios.length > 0) params.set("studio", selectedStudios.join(","));
    if (minScore > 0) params.set("minScore", String(minScore));
    if (maxScore > 0) params.set("maxScore", String(maxScore));
    router.push(`/library?${params.toString()}`);
  };

  const clearAll = () => {
    setFranchise("");
    setFormat("");
    setContext("");
    setWatchStatus("");
    setSelectedGenres([]);
    setSelectedStudios([]);
    setMinScore(0);
    setMaxScore(0);
  };

  // Back link preserves current library URL state
  const backParams = new URLSearchParams();
  for (const key of [
    "sort", "search", "verified", "status",
    "franchise", "format", "context", "genre", "studio", "minScore", "maxScore",
  ]) {
    if (initialParams[key]) backParams.set(key, initialParams[key]);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5">

        {/* Watch Status */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Watch Status</label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setWatchStatus("")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                watchStatus === ""
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
              }`}
            >
              All
            </button>
            {WATCH_STATUSES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setWatchStatus((prev) => (prev === value ? "" : value))}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  watchStatus === value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Franchise */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Franchise</label>
          <select
            value={franchise}
            onChange={(e) => setFranchise(e.target.value)}
            className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Franchises</option>
            {franchises.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Format */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Format</label>
          <div className="flex gap-2">
            {(
              [
                { value: "", label: "All" },
                { value: "SERIES", label: "Series" },
                { value: "MOVIE", label: "Movie" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value || "all"}
                onClick={() => setFormat(value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  format === value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Watch Party */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Watch Party</label>
          <select
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">All</option>
            <option value="NONE">None (self)</option>
            {people.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Genre */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Genre</label>
          <TagSelect
            options={genres}
            selected={selectedGenres}
            onChange={setSelectedGenres}
            placeholder="Search genres..."
          />
        </div>

        {/* Studio */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Studio</label>
          <TagSelect
            options={studios}
            selected={selectedStudios}
            onChange={setSelectedStudios}
            placeholder="Search studios..."
          />
        </div>

        {/* Personal Rating range */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Personal Rating</label>
          <div className="space-y-3">
            <StarRating value={minScore} onChange={setMinScore} label="Min" />
            <StarRating value={maxScore} onChange={setMaxScore} label="Max" />
          </div>
        </div>

      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
        <button
          onClick={applyFilters}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-colors"
        >
          Apply Filters
        </button>
        <button
          onClick={clearAll}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-sm transition-colors"
        >
          Clear All
        </button>
        <Link
          href={`/library?${backParams.toString()}`}
          className="ml-auto text-slate-400 hover:text-white text-sm transition-colors"
        >
          ← Back to Library
        </Link>
      </div>
    </div>
  );
}
