"use client";

import { useState } from "react";
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
  const [selectedAnimeId, setSelectedAnimeId] = useState("");
  const [order, setOrder] = useState("");
  const [entryType, setEntryType] = useState<FranchiseEntryType>("MAIN");
  const [submitting, setSubmitting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(franchise.name);
  const [description, setDescription] = useState(franchise.description ?? "");

  const trackedIds = new Set(franchise.entries.map((e) => e.animeId));
  const available = allAnime.filter((a) => !trackedIds.has(a.id));

  async function addEntry() {
    if (!selectedAnimeId || !order) return;
    setSubmitting(true);
    await fetch(`/api/franchises/${franchise.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animeId: Number(selectedAnimeId),
        order: Number(order),
        entryType,
      }),
    });
    setAddingEntry(false);
    setSelectedAnimeId("");
    setOrder("");
    setSubmitting(false);
    router.refresh();
  }

  async function removeEntry(entryId: number) {
    await fetch(`/api/franchise-entries/${entryId}`, { method: "DELETE" });
    router.refresh();
  }

  async function saveName() {
    await fetch(`/api/franchises/${franchise.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || null }),
    });
    setEditingName(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          {editingName ? (
            <div className="space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-md px-3 py-2 text-lg font-bold focus:outline-none focus:border-indigo-500"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2">
                <button onClick={() => setEditingName(false)} className="text-sm text-slate-400 border border-slate-700 px-3 py-1.5 rounded-md">Cancel</button>
                <button onClick={saveName} className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-md">Save</button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold text-white">{franchise.name}</h2>
              {franchise.description && <p className="text-slate-400 text-sm mt-1">{franchise.description}</p>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/franchises" className="text-sm text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-md">← Back</Link>
          {!editingName && (
            <button onClick={() => setEditingName(true)} className="text-sm text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-md">Edit</button>
          )}
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
          <select
            value={selectedAnimeId}
            onChange={(e) => setSelectedAnimeId(e.target.value)}
            className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">— Select anime —</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>{a.titleEnglish || a.titleRomaji}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Watch Order</label>
              <input
                type="number"
                min={1}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="1"
                className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
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
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAddingEntry(false)} className="text-sm text-slate-400 border border-slate-700 px-3 py-1.5 rounded-md">Cancel</button>
            <button
              onClick={addEntry}
              disabled={submitting || !selectedAnimeId || !order}
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
