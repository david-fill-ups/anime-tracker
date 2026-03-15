"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  animeId: number;
  streamingCheckedAt: Date | string | null | undefined;
};

function formatCheckedAt(date: Date | string | null | undefined): string {
  if (!date) return "never";
  const diffMs = Date.now() - new Date(date).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function StreamingLastUpdated({ animeId, streamingCheckedAt }: Props) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [checkedAt, setCheckedAt] = useState(streamingCheckedAt);

  if (checkedAt === null || checkedAt === undefined) return null;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch(`/api/anime/${animeId}/streaming/refresh`, { method: "POST" });
      setCheckedAt(new Date());
      router.refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <p
        className="text-xs text-slate-600"
        title={new Date(checkedAt).toLocaleString()}
        suppressHydrationWarning
      >
        Last updated {formatCheckedAt(checkedAt)}
      </p>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        title="Refresh streaming data"
        className="text-slate-600 hover:text-slate-400 disabled:opacity-40 transition-colors"
        suppressHydrationWarning
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`}
        >
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      </button>
    </div>
  );
}
