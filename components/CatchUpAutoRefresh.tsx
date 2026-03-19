"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  staleIds: number[];
};

// Module-level set survives React Strict Mode's intentional double-mount,
// which resets refs and would otherwise start two concurrent sync loops.
const syncingIds = new Set<number>();

export default function CatchUpAutoRefresh({ staleIds }: Props) {
  const router = useRouter();

  useEffect(() => {
    const toSync = staleIds.filter((id) => !syncingIds.has(id));
    if (toSync.length === 0) return;
    for (const id of toSync) syncingIds.add(id);

    // Sequential with adaptive backoff to avoid rate-limiting AniList
    async function runSequential() {
      let delay = 1500;
      for (let i = 0; i < toSync.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, delay));
        const res = await fetch(`/api/anime/${toSync[i]}/sync?anilistOnly=true`, { method: "POST" }).catch(() => null);
        if (res?.status === 502 || res?.status === 429) {
          delay = Math.min(delay * 2, 10000); // back off on rate limit, max 10s
        } else if (res?.ok) {
          delay = Math.max(1500, delay * 0.75); // gradually recover toward baseline
        }
        syncingIds.delete(toSync[i]);
      }
      router.refresh();
    }

    runSequential().catch(() => {});
  }, [staleIds, router]);

  return null;
}
