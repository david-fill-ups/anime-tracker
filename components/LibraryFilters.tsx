"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { STATUS_CONFIG } from "./StatusBadge";
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
  const [refreshing, setRefreshing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; total: number } | null>(null);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync-all", { method: "POST" });
      const data = await res.json();
      setSyncResult({ synced: data.synced, total: data.total });
      router.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [router]);

  const set = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 on filter change
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

  const activeStatus = searchParams.get("status") || "ALL";
  const activeSort = searchParams.get("sort") || "updatedAt";
  const activeSearch = searchParams.get("search") || "";
  const activeFranchise = searchParams.get("franchise") || "";
  const activeFormat = searchParams.get("format") || "";
  const activeContext = searchParams.get("context") || "";
  const activeGenre = searchParams.get("genre") || "";
  const activeStudio = searchParams.get("studio") || "";
  const activeVerified = searchParams.get("verified") || ""; // TODO[TEMP]: remove after data review

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

      {/* Active genre / studio chips */}
      {(activeGenre || activeStudio) && (
        <div className="flex gap-2 flex-wrap">
          {activeGenre && (
            <button
              onClick={() => set("genre", "")}
              className="flex items-center gap-1.5 bg-indigo-900/50 border border-indigo-700 text-indigo-300 text-sm px-3 py-1 rounded-full hover:bg-indigo-900 transition-colors"
            >
              Genre: {activeGenre}
              <span className="text-indigo-400">×</span>
            </button>
          )}
          {activeStudio && (
            <button
              onClick={() => set("studio", "")}
              className="flex items-center gap-1.5 bg-indigo-900/50 border border-indigo-700 text-indigo-300 text-sm px-3 py-1 rounded-full hover:bg-indigo-900 transition-colors"
            >
              Studio: {activeStudio}
              <span className="text-indigo-400">×</span>
            </button>
          )}
        </div>
      )}

      {/* Search + filters row */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="search"
          placeholder="Search titles..."
          defaultValue={activeSearch}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />

        <select
          value={activeFranchise}
          onChange={(e) => set("franchise", e.target.value)}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Franchises</option>
          {franchises.map((f) => (
            <option key={f.id} value={String(f.id)}>
              {f.name}
            </option>
          ))}
        </select>

        <select
          value={activeFormat}
          onChange={(e) => set("format", e.target.value)}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Formats</option>
          <option value="SERIES">Series</option>
          <option value="MOVIE">Movie</option>
        </select>

        <select
          value={activeContext}
          onChange={(e) => set("context", e.target.value)}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Watch Contexts</option>
          {people.map((p) => (
            <option key={p.id} value={String(p.id)}>{p.name}</option>
          ))}
        </select>

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

        <button
          onClick={handleRefreshAll}
          disabled={refreshing}
          className="bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 px-3 py-2 rounded-md text-sm transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {refreshing
            ? "Refreshing..."
            : syncResult
            ? `Synced ${syncResult.synced} / ${syncResult.total}`
            : "Refresh All"}
        </button>

        {/* TODO[TEMP]: Verified filter — remove after data review */}
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
