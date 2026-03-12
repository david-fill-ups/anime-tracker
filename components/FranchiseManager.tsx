"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "./StatusBadge";
import type { Anime, UserEntry, FranchiseEntry, Franchise } from "@/app/generated/prisma";

type EntryWithAnime = FranchiseEntry & {
  anime: Anime & { userEntry: UserEntry | null };
};
type FranchiseWithEntries = Franchise & { entries: EntryWithAnime[] };

export default function FranchiseManager({
  franchises,
}: {
  franchises: FranchiseWithEntries[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function createFranchise() {
    if (!newName.trim()) return;
    setSubmitting(true);
    await fetch("/api/franchises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
    });
    setCreating(false);
    setNewName("");
    setNewDesc("");
    setSubmitting(false);
    router.refresh();
  }

  // Find the "next" unwatched entry in a franchise for continuation suggestion
  function getNextUnwatched(entries: EntryWithAnime[]): EntryWithAnime | null {
    const mainEntries = entries.filter((e) => e.entryType === "MAIN");
    for (const entry of mainEntries) {
      const status = entry.anime.userEntry?.watchStatus;
      if (!status || status === "PLAN_TO_WATCH") {
        return entry;
      }
    }
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Create button */}
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          + New Franchise
        </button>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3 max-w-md">
          <h3 className="text-sm font-semibold text-white">New Franchise</h3>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Franchise name"
            className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setCreating(false)}
              className="text-sm text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={createFranchise}
              disabled={submitting || !newName.trim()}
              className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {franchises.length === 0 && (
        <p className="text-slate-500 text-sm">No franchises yet. Create one to group related anime.</p>
      )}

      {/* Franchise cards */}
      <div className="space-y-4">
        {franchises.map((franchise) => {
          const next = getNextUnwatched(franchise.entries);
          return (
            <div key={franchise.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="mb-3">
                <Link
                  href={`/franchises/${franchise.id}`}
                  className="font-semibold text-white hover:text-indigo-400 transition-colors"
                >
                  {franchise.name}
                </Link>
                {franchise.description && (
                  <p className="text-sm text-slate-400 mt-0.5">{franchise.description}</p>
                )}
              </div>

              {/* Entries */}
              <div className="space-y-2">
                {franchise.entries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3">
                    <Link
                      href={`/anime/${entry.anime.id}`}
                      className="flex-1 text-sm text-slate-300 hover:text-white truncate"
                    >
                      {entry.anime.titleEnglish || entry.anime.titleRomaji}
                    </Link>
                    <span className="text-xs text-slate-600">{entry.entryType}</span>
                    {entry.anime.userEntry ? (
                      <StatusBadge status={entry.anime.userEntry.watchStatus} />
                    ) : (
                      <span className="text-xs text-slate-600">Not tracked</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Continuation suggestion */}
              {next && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <p className="text-xs text-slate-400">
                    Next up:{" "}
                    <Link href={`/anime/${next.anime.id}`} className="text-indigo-400 hover:text-indigo-300 font-medium">
                      {next.anime.titleEnglish || next.anime.titleRomaji}
                    </Link>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
