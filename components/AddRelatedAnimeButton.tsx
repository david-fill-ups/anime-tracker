"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AddRelatedAnimeButton({
  anilistId,
  linkId,
}: {
  anilistId: number;
  linkId: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [addState, setAddState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [notInterestedState, setNotInterestedState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function addStandalone(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    setAddState("loading");
    const res = await fetch("/api/anime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "ANILIST", anilistId, watchStatus: "PLAN_TO_WATCH" }),
    });
    setAddState(res.ok ? "done" : "error");
    if (res.ok) router.refresh();
  }

  async function addToLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    setAddState("loading");
    const res = await fetch(`/api/links/${linkId}/anime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anilistId }),
    });
    setAddState(res.ok ? "done" : "error");
    if (res.ok) router.refresh();
  }

  async function markNotInterested(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setNotInterestedState("loading");
    const res = await fetch("/api/anime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "ANILIST", anilistId, watchStatus: "NOT_INTERESTED" }),
    });
    setNotInterestedState(res.ok ? "done" : "error");
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.preventDefault()}>
      {/* Not interested button */}
      {notInterestedState === "done" ? (
        <span className="text-xs text-slate-500 w-6 text-center">✕</span>
      ) : notInterestedState === "error" ? (
        <span
          className="text-xs text-red-400 w-6 text-center cursor-pointer"
          title="Failed — click to retry"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNotInterestedState("idle"); }}
        >
          !
        </span>
      ) : notInterestedState === "loading" ? (
        <span className="text-xs text-slate-500 w-6 text-center">…</span>
      ) : (
        <button
          onClick={markNotInterested}
          title="Not interested"
          className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-white hover:bg-slate-700 transition-colors"
          suppressHydrationWarning
        >
          <span className="text-sm leading-none">✕</span>
        </button>
      )}

      {/* Add button */}
      {addState === "done" ? (
        <span className="text-xs text-emerald-400 w-6 text-center">✓</span>
      ) : addState === "error" ? (
        <span
          className="text-xs text-red-400 w-6 text-center cursor-pointer"
          title="Failed — click to retry"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAddState("idle"); }}
        >
          !
        </span>
      ) : addState === "loading" ? (
        <span className="text-xs text-slate-500 w-6 text-center">…</span>
      ) : (
        <div ref={ref} className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
            title="Add to library"
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-indigo-600 transition-colors"
            suppressHydrationWarning
          >
            <span className="text-base leading-none">+</span>
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl min-w-[160px] overflow-hidden">
              <button
                onClick={addStandalone}
                className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Add standalone
              </button>
              {linkId && (
                <button
                  onClick={addToLink}
                  className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors border-t border-slate-700"
                >
                  Add to link
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
