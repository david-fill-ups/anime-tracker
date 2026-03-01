"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  animeId: number;
  source?: string | null;
};

export default function StreamingAutoRefresh({ animeId, source }: Props) {
  const router = useRouter();
  // Guard against double-firing in React StrictMode
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    Promise.all([
      fetch(`/api/anime/${animeId}/streaming/refresh`, { method: "POST" }),
      fetch(`/api/anime/${animeId}/refresh-seasons`, { method: "POST" }),
      ...(source === "ANILIST" ? [fetch(`/api/anime/${animeId}/sync`, { method: "POST" })] : []),
    ])
      .then(() => router.refresh())
      .catch(() => {
        // Silent failure
      });
  }, [animeId, source, router]);

  return null;
}
