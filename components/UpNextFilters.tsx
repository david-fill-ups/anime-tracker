"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { StreamingService } from "@/app/generated/prisma";

const SERVICE_LABELS: Record<StreamingService, string> = {
  CRUNCHYROLL: "Crunchyroll",
  NETFLIX: "Netflix",
  HULU: "Hulu",
  DISNEY_PLUS: "Disney+",
  HBO: "HBO Max",
  AMAZON_PRIME: "Prime Video",
  HIDIVE: "HIDIVE",
};

const AIRING_STATUSES = [
  { value: "FINISHED", label: "Finished" },
  { value: "RELEASING", label: "Airing" },
  { value: "HIATUS", label: "Hiatus" },
  { value: "NOT_YET_RELEASED", label: "Upcoming" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

const SELECT_CLASS =
  "bg-slate-800 text-slate-300 border border-slate-700 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500";

export default function UpNextFilters({
  services,
  recommenders,
}: {
  services: StreamingService[];
  recommenders: { id: number; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const activeService = searchParams.get("service") || "";
  const activeAiringStatus = searchParams.get("airingStatus") || "";
  const activeRecommender = searchParams.get("recommender") || "";
  const activeQuickBinge = searchParams.get("quickBinge") === "1";

  const hasActiveFilters = !!(activeService || activeAiringStatus || activeRecommender || activeQuickBinge);

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("service");
    params.delete("airingStatus");
    params.delete("recommender");
    params.delete("quickBinge");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {/* Where to Watch */}
      <select
        value={activeService}
        onChange={(e) => set("service", e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">Where to Watch</option>
        {services.map((svc) => (
          <option key={svc} value={svc}>
            {SERVICE_LABELS[svc]}
          </option>
        ))}
      </select>

      {/* Series Status */}
      <select
        value={activeAiringStatus}
        onChange={(e) => set("airingStatus", e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">Series Status</option>
        {AIRING_STATUSES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {/* Recommended By */}
      <select
        value={activeRecommender}
        onChange={(e) => set("recommender", e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">Recommended By</option>
        {recommenders.map((p) => (
          <option key={p.id} value={String(p.id)}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Quick Binge */}
      <button
        onClick={() => set("quickBinge", activeQuickBinge ? "" : "1")}
        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
          activeQuickBinge
            ? "bg-indigo-600 text-white"
            : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700"
        }`}
      >
        ⚡ Quick Binge
      </button>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
