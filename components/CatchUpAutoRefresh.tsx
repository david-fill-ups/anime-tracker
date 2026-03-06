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

    Promise.all(staleIds.map((id) => fetch(`/api/anime/${id}/sync`, { method: "POST" })))
      .then(() => router.refresh())
      .catch(() => {});
  }, [staleIds, router]);

  return null;
}
