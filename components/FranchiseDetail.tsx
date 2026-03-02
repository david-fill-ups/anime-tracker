"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "./StatusBadge";
import type { Anime, UserEntry, FranchiseEntry, Franchise, FranchiseEntryType } from "@/app/generated/prisma";

type EntryWithAnime = FranchiseEntry & {
  anime: Anime & { userEntry: UserEntry | null };
};
type Props = {
  franchise: Franchise & { entries: EntryWithAnime[] };
  allAnime: Anime[];
};

export default function FranchiseDetail({ franchise, allAnime }: Props) {
  const router = useRouter();
  const [addingEntry, setAddingEntry] = useState(false);
  const [animeSearch, setAnimeSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
  const [selectedAnimeTitle, setSelectedAnimeTitle] = useState("");
  const [entryType, setEntryType] = useState<FranchiseEntryType>("MAIN");
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(franchise.name);
  const [description, setDescription] = useState(franchise.description ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const trackedIds = new Set(franchise.entries.map((e) => e.animeId));
  const available = allAnime.filter((a) => !trackedIds.has(a.id));

  const filteredAvailable = available.filter((a) => {
    if (!animeSearch.trim()) return true;
    const title = (a.titleEnglish || a.titleRomaji).toLowerCase();
    return title.includes(animeSearch.toLowerCase());
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function addEntry() {
    if (!selectedAnimeId) return;
    setSubmitting(true);
    await fetch(`/api/franchises/${franchise.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animeId: selectedAnimeId,
        entryType,
      }),
    });
    setAddingEntry(false);
    setAnimeSearch("");
    setSelectedAnimeId(null);
    setSelectedAnimeTitle("");
    setSubmitting(false);
    router.refresh();
  }

  async function removeEntry(entryId: number) {
    await fetch(`/api/franchise-entries/${entryId}`, { method: "DELETE" });
    router.refresh();
  }

  async function saveMeta() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch(`/api/franchises/${franchise.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
    });
    setSaving(false);
    router.refresh();
  }

  async function deleteFranchise() {
    if (!confirm("Delete this franchise? Anime entries will not be deleted.")) return;
    setDeleting(true);
    await fetch(`/api/franchises/${franchise.id}`, { method: "DELETE" });
    router.push("/franchises");
  }

  return (
    <div className="space-y-6">
      {/* Header — always-editable */}
      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-transparent text-white text-2xl font-bold border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-0 py-1 transition-colors"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full bg-transparent text-slate-400 text-sm border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-0 py-1 transition-colors placeholder:text-slate-600"
        />
        <div className="flex items-center gap-2 pt-1">
          <Link href="/franchises" className="text-sm text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-md">
            ← Back
          </Link>
          <button
            onClick={saveMeta}
            disabled={saving || !name.trim()}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={deleteFranchise}
            disabled={deleting}
            className="ml-auto text-sm text-red-500 hover:text-red-400 border border-red-900 hover:border-red-700 px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
          >
            Delete Franchise
          </button>
        </div>
      </div>

      {/* Entries list */}
      <div className="space-y-2">
        {franchise.entries.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
            <span className="text-slate-500 text-sm w-6 text-right">{entry.order}.</span>
            <Link href={`/anime/${entry.anime.id}`} className="flex-1 text-sm text-slate-200 hover:text-white font-medium truncate">
              {entry.anime.titleEnglish || entry.anime.titleRomaji}
            </Link>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{entry.entryType}</span>
            {entry.anime.userEntry ? (
              <StatusBadge status={entry.anime.userEntry.watchStatus} />
            ) : (
              <span className="text-xs text-slate-600">Untracked</span>
            )}
            <button
              onClick={() => removeEntry(entry.id)}
              className="text-slate-600 hover:text-red-400 text-sm ml-1"
            >
              ✕
            </button>
          </div>
        ))}

        {franchise.entries.length === 0 && (
          <p className="text-slate-500 text-sm">No entries yet.</p>
        )}
      </div>

      {/* Add entry */}
      {!addingEntry ? (
        <button
          onClick={() => setAddingEntry(true)}
          className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-md transition-colors"
        >
          + Add Anime to Franchise
        </button>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Add Entry</h3>

          {/* Searchable anime picker */}
          <div ref={searchRef} className="relative">
            {selectedAnimeId ? (
              <div className="flex items-center gap-2 bg-slate-800 border border-indigo-500/50 rounded-md px-3 py-2">
                <span className="flex-1 text-sm text-slate-100">{selectedAnimeTitle}</span>
                <button
                  onClick={() => { setSelectedAnimeId(null); setSelectedAnimeTitle(""); setAnimeSearch(""); }}
                  className="text-slate-500 hover:text-slate-300 text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <input
                value={animeSearch}
                onChange={(e) => { setAnimeSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search anime…"
                className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            )}

            {showDropdown && !selectedAnimeId && (
              <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredAvailable.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500">No results</p>
                ) : (
                  filteredAvailable.slice(0, 50).map((a) => (
                    <button
                      key={a.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedAnimeId(a.id);
                        setSelectedAnimeTitle(a.titleEnglish || a.titleRomaji);
                        setAnimeSearch("");
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      {a.titleEnglish || a.titleRomaji}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Type</label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as FranchiseEntryType)}
              className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="MAIN">Main</option>
              <option value="SIDE_STORY">Side Story</option>
              <option value="MOVIE">Movie</option>
              <option value="OVA">OVA</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setAddingEntry(false); setAnimeSearch(""); setSelectedAnimeId(null); setSelectedAnimeTitle(""); }} className="text-sm text-slate-400 border border-slate-700 px-3 py-1.5 rounded-md">Cancel</button>
            <button
              onClick={addEntry}
              disabled={submitting || !selectedAnimeId}
              className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
