"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  staleIds: number[];
};

export default function CatchUpAutoRefresh({ staleIds }: Props) {
  const router = useRouter();
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current || staleIds.length === 0) return;
    hasFired.current = true;

    // Sequential with adaptive backoff to avoid rate-limiting AniList
    async function runSequential() {
      let delay = 1500;
      for (let i = 0; i < staleIds.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, delay));
        const res = await fetch(`/api/anime/${staleIds[i]}/sync?anilistOnly=true`, { method: "POST" }).catch(() => null);
        if (res?.status === 502 || res?.status === 429) {
          delay = Math.min(delay * 2, 10000); // back off on rate limit, max 10s
        } else if (res?.ok) {
          delay = Math.max(1500, delay * 0.75); // gradually recover toward baseline
        }
      }
      router.refresh();
    }

    runSequential().catch(() => {});
  }, [staleIds, router]);

  return null;
}
