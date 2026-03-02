"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { WatchStatus } from "@/app/generated/prisma";

const SORT_OPTIONS = [
  { value: "updatedAt", label: "Recent Activity" },
  { value: "startedAt", label: "Date Started" },
  { value: "completedAt", label: "Date Completed" },
  { value: "score", label: "My Score" },
  { value: "meanScore", label: "Community Score" },
  { value: "title", label: "Title A–Z" },
];

const STATUS_TABS: { value: WatchStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "WATCHING", label: "Watching" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "DROPPED", label: "Dropped" },
];

export default function LibraryFilters({
  franchises,
  people,
  counts,
}: {
  franchises: { id: number; name: string }[];
  people: { id: number; name: string }[];
  counts: Partial<Record<WatchStatus | "ALL", number>>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const setSearch = useCallback(
    (value: string) => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
      searchDebounce.current = setTimeout(() => set("search", value), 300);
    },
    [set]
  );

  const clearChip = useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (key === "rating") {
        params.delete("minScore");
        params.delete("maxScore");
      } else if (key.startsWith("genre:")) {
        const g = key.slice(6);
        const remaining = (params.get("genre") ?? "").split(",").filter((x) => x && x !== g);
        remaining.length === 0 ? params.delete("genre") : params.set("genre", remaining.join(","));
      } else if (key.startsWith("studio:")) {
        const s = key.slice(7);
        const remaining = (params.get("studio") ?? "").split(",").filter((x) => x && x !== s);
        remaining.length === 0 ? params.delete("studio") : params.set("studio", remaining.join(","));
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const activeStatus = searchParams.get("status") || "ALL";
  const activeSort = searchParams.get("sort") || "updatedAt";
  const activeSearch = searchParams.get("search") || "";
  const activeFranchise = searchParams.get("franchise") || "";
  const activeFormat = searchParams.get("format") || "";
  const activeContext = searchParams.get("context") || "";
  const activeGenre = searchParams.get("genre") || "";
  const activeStudio = searchParams.get("studio") || "";
  const activeMinScore = searchParams.get("minScore") || "";
  const activeMaxScore = searchParams.get("maxScore") || "";
  const activeVerified = searchParams.get("verified") || ""; // TODO[TEMP]: remove after data review

  const activeGenreList = activeGenre ? activeGenre.split(",").filter(Boolean) : [];
  const activeStudioList = activeStudio ? activeStudio.split(",").filter(Boolean) : [];

  // Count active filters (those managed by the filters page)
  const activeFilterCount = [
    activeFranchise,
    activeFormat,
    activeContext,
    activeGenre,
    activeStudio,
    activeMinScore || activeMaxScore,
  ].filter(Boolean).length;

  // Resolve display names for chips
  const franchiseName = activeFranchise
    ? franchises.find((f) => String(f.id) === activeFranchise)?.name
    : null;
  const contextName =
    activeContext === "NONE"
      ? "None (self)"
      : activeContext
      ? people.find((p) => String(p.id) === activeContext)?.name ?? null
      : null;
  const formatLabel =
    activeFormat === "SERIES" ? "Series" : activeFormat === "MOVIE" ? "Movie" : null;
  const ratingLabel =
    activeMinScore && activeMaxScore
      ? `${activeMinScore}–${activeMaxScore} stars`
      : activeMinScore
      ? `≥${activeMinScore} stars`
      : activeMaxScore
      ? `≤${activeMaxScore} stars`
      : null;

  const activeChips: { key: string; label: string }[] = [
    ...(franchiseName ? [{ key: "franchise", label: `Franchise: ${franchiseName}` }] : []),
    ...(formatLabel ? [{ key: "format", label: `Format: ${formatLabel}` }] : []),
    ...(contextName ? [{ key: "context", label: `Watch Party: ${contextName}` }] : []),
    ...activeGenreList.map((g) => ({ key: `genre:${g}`, label: g })),
    ...activeStudioList.map((s) => ({ key: `studio:${s}`, label: s })),
    ...(ratingLabel ? [{ key: "rating", label: ratingLabel }] : []),
  ];

  const [searchValue, setSearchValue] = useState(activeSearch);

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map(({ value, label }) => {
          const count = counts[value] ?? 0;
          const active = activeStatus === value;
          return (
            <button
              key={value}
              onClick={() => set("status", value === "ALL" ? "" : value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs ${active ? "text-indigo-200" : "text-slate-500"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {activeChips.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => clearChip(key)}
              className="flex items-center gap-1.5 bg-indigo-900/50 border border-indigo-700 text-indigo-300 text-sm px-3 py-1 rounded-full hover:bg-indigo-900 transition-colors"
            >
              {label}
              <span className="text-indigo-400">×</span>
            </button>
          ))}
        </div>
      )}

      {/* Search + filters button + sort row */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="search"
          placeholder="Search titles..."
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
            setSearch(e.target.value);
          }}
          className="flex-1 min-w-48 bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />

        <Link
          href={`/library/filters?${searchParams.toString()}`}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors border whitespace-nowrap ${
            activeFilterCount > 0
              ? "bg-indigo-900/50 border-indigo-600 text-indigo-300 hover:bg-indigo-900"
              : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
              clipRule="evenodd"
            />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
              {activeFilterCount}
            </span>
          )}
        </Link>

        <select
          value={activeSort}
          onChange={(e) => set("sort", e.target.value)}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>

      </div>

      {/* TODO[TEMP]: Verified filter — remove after data review */}
      <div>
        <select
          value={activeVerified}
          onChange={(e) => set("verified", e.target.value)}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">All (verified + unverified)</option>
          <option value="false">Unverified only</option>
          <option value="true">Verified only</option>
        </select>
      </div>
    </div>
  );
}
