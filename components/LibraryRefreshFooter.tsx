"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function formatRelative(date: string | null): string {
  if (!date) return "never";
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default function LibraryRefreshFooter({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync-all", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Refresh failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mt-8 flex items-center gap-2 text-xs text-slate-600">
      <span>Last updated {formatRelative(lastSyncedAt)}</span>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        title="Refresh all metadata and streaming links"
        className="text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={refreshing ? "animate-spin" : ""}
        >
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
      </button>
      {error && <span className="text-red-500 ml-1">{error}</span>}
    </div>
  );
}
