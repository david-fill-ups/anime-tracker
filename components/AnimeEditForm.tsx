"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Anime, UserEntry, Person, Franchise } from "@/app/generated/prisma";

type Props = {
  anime: Anime & { franchiseEntries: { franchise: { id: number; name: string } }[] };
  entry: UserEntry & { recommender: Person | null } | null;
  people: Person[];
  franchises: Franchise[];
};

export default function AnimeEditForm({ anime, entry, people, franchises }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    watchStatus: entry?.watchStatus ?? "PLAN_TO_WATCH",
    currentEpisode: String(entry?.currentEpisode ?? 0),
    score: entry?.score != null ? String(entry.score) : "",
    notes: entry?.notes ?? "",
    watchContext: entry?.watchContext ?? "",
    watchPartyWith: entry?.watchPartyWith ?? "",
    recommenderId: entry?.recommenderId ? String(entry.recommenderId) : "",
    startedAt: entry?.startedAt ? entry.startedAt.toISOString().split("T")[0] : "",
    completedAt: entry?.completedAt ? entry.completedAt.toISOString().split("T")[0] : "",
    rewatchCount: String(entry?.rewatchCount ?? 0),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    setMsg("");
    await fetch(`/api/anime/${anime.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        watchStatus: form.watchStatus,
        currentEpisode: Number(form.currentEpisode),
        score: form.score ? Number(form.score) : null,
        notes: form.notes || null,
        watchContext: form.watchContext || null,
        watchPartyWith: form.watchContext === "WATCH_PARTY" ? form.watchPartyWith : null,
        recommenderId: form.recommenderId ? Number(form.recommenderId) : null,
        startedAt: form.startedAt || null,
        completedAt: form.completedAt || null,
        rewatchCount: Number(form.rewatchCount),
      }),
    });
    setSaving(false);
    setMsg("Saved.");
    router.refresh();
  }

  async function syncAniList() {
    if (!anime.anilistId) return;
    setSyncing(true);
    setMsg("");
    // Re-fetch metadata from AniList and update
    const res = await fetch(`/api/anime/${anime.id}/sync`, { method: "POST" });
    if (res.ok) setMsg("Synced with AniList.");
    else setMsg("Sync failed.");
    setSyncing(false);
    router.refresh();
  }

  async function deleteAnime() {
    if (!confirm("Remove this anime from your library?")) return;
    setDeleting(true);
    await fetch(`/api/anime/${anime.id}`, { method: "DELETE" });
    router.push("/library");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Status</label>
          <select
            value={form.watchStatus}
            onChange={(e) => set("watchStatus", e.target.value)}
            className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="WATCHING">Watching</option>
            <option value="COMPLETED">Completed</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="DROPPED">Dropped</option>
            <option value="PLAN_TO_WATCH">Plan to Watch</option>
            <option value="RECOMMENDED">Recommended</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Episode Progress</label>
          <input
            type="number"
            min={0}
            value={form.currentEpisode}
            onChange={(e) => set("currentEpisode", e.target.value)}
            className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Your Score (1–10)</label>
          <input
            type="number"
            min={1}
            max={10}
            step={0.5}
            value={form.score}
            onChange={(e) => set("score", e.target.value)}
            className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Rewatch Count</label>
          <input
            type="number"
            min={0}
            value={form.rewatchCount}
            onChange={(e) => set("rewatchCount", e.target.value)}
            className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Watch Context</label>
          <select
            value={form.watchContext}
            onChange={(e) => set("watchContext", e.target.value)}
            className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">— Not set —</option>
            <option value="SOLO">Solo</option>
            <option value="WATCH_PARTY">Watch Party</option>
          </select>
        </div>

        {form.watchContext === "WATCH_PARTY" && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Watching with</label>
            <input
              value={form.watchPartyWith}
              onChange={(e) => set("watchPartyWith", e.target.value)}
              className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1">Recommended by</label>
          <select
            value={form.recommenderId}
            onChange={(e) => set("recommenderId", e.target.value)}
            className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">— None —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Started</label>
          <input
            type="date"
            value={form.startedAt}
            onChange={(e) => set("startedAt", e.target.value)}
            className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Completed</label>
          <input
            type="date"
            value={form.completedAt}
            onChange={(e) => set("completedAt", e.target.value)}
            className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={4}
          className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      {msg && <p className="text-sm text-green-400">{msg}</p>}

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {anime.source === "ANILIST" && (
          <button
            onClick={syncAniList}
            disabled={syncing}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-md transition-colors disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync AniList"}
          </button>
        )}

        <button
          onClick={deleteAnime}
          disabled={deleting}
          className="ml-auto px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 rounded-md transition-colors disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
