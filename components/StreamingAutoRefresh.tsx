"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

function isStale(date: Date | string | null | undefined): boolean {
  if (!date) return true;
  return Date.now() - new Date(date).getTime() > STALE_MS;
}

type Props = {
  animeId: number;
  source?: string | null;
  streamingCheckedAt?: Date | string | null;
  lastSyncedAt?: Date | string | null;
};

export default function StreamingAutoRefresh({ animeId, source, streamingCheckedAt, lastSyncedAt }: Props) {
  const router = useRouter();
  // Guard against double-firing in React StrictMode
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    const requests: Promise<Response>[] = [];

    if (isStale(streamingCheckedAt))
      requests.push(fetch(`/api/anime/${animeId}/streaming/refresh`, { method: "POST" }));

    if (isStale(streamingCheckedAt))
      requests.push(fetch(`/api/anime/${animeId}/refresh-seasons`, { method: "POST" }));

    if (source === "ANILIST" && isStale(lastSyncedAt))
      requests.push(fetch(`/api/anime/${animeId}/sync`, { method: "POST" }));

    if (requests.length === 0) return;

    Promise.all(requests)
      .then(() => router.refresh())
      .catch(() => {
        // Silent failure
      });
  }, [animeId, source, streamingCheckedAt, lastSyncedAt, router]);

  return null;
}
