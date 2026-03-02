"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STAR_PATH =
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = display >= star;
        const half = !full && display >= star - 0.5;
        return (
          <div key={star} className="relative w-8 h-8">
            <svg viewBox="0 0 24 24" className="w-8 h-8 pointer-events-none">
              <path d={STAR_PATH} fill="#475569" />
              {full && <path d={STAR_PATH} fill="#facc15" />}
              {half && (
                <path d={STAR_PATH} fill="#facc15" style={{ clipPath: "inset(0 50% 0 0)" }} />
              )}
            </svg>
            <div
              className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
              onMouseEnter={() => setHover(star - 0.5)}
              onClick={() => onChange(value === star - 0.5 ? 0 : star - 0.5)}
            />
            <div
              className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
              onMouseEnter={() => setHover(star)}
              onClick={() => onChange(value === star ? 0 : star)}
            />
          </div>
        );
      })}
      <span className="ml-2 text-sm text-slate-400 min-w-[3rem]">
        {value > 0 ? `${value} / 5` : "—"}
      </span>
      {value > 0 && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="ml-1 text-slate-600 hover:text-slate-400 transition-colors"
          title="Clear score"
        >
          ✕
        </button>
      )}
    </div>
  );
}
import type { Anime, UserEntry, Person, Franchise } from "@/app/generated/prisma";

type Props = {
  anime: Anime & { franchiseEntries: { id: number; franchise: { id: number; name: string } }[] };
  entry: UserEntry & { recommender: Person | null; watchContextPerson: Person | null } | null;
  people: Person[];
  franchises: Franchise[];
};

export default function AnimeEditForm({ anime, entry, people, franchises }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingFranchise, setAddingFranchise] = useState(false);
  const [newFranchiseId, setNewFranchiseId] = useState("");
  const [newFranchiseEntryType, setNewFranchiseEntryType] = useState("MAIN");


  const [msg, setMsg] = useState("");

  // Season/episode helpers — derived from prop (updates after router.refresh())
  const parsedEpsPerSeason: number[] = anime.episodesPerSeason
    ? JSON.parse(anime.episodesPerSeason)
    : [];
  const getEpsForSeason = (season: number) =>
    parsedEpsPerSeason[season - 1] ?? anime.totalEpisodes ?? 1;

  const totalSeasons = Math.max(1, anime.totalSeasons ?? 1);
  const useSeasonDropdowns = totalSeasons > 1 || !!(anime.totalEpisodes);

  // Convert flat episode index → { season, episode }
  const flatToSE = (flat: number) => {
    if (totalSeasons <= 1 || flat === 0) return { season: 1, episode: flat };
    let remaining = flat;
    for (let s = 1; s <= totalSeasons; s++) {
      const sEps = getEpsForSeason(s);
      if (remaining <= sEps || s === totalSeasons) return { season: s, episode: remaining };
      remaining -= sEps;
    }
    return { season: 1, episode: flat };
  };

  const initFlat = entry?.currentEpisode ?? 0;
  const initSE = flatToSE(initFlat);

  const [externalUrl, setExternalUrl] = useState(anime.externalUrl ?? "");

  const [form, setForm] = useState({
    watchStatus: entry?.watchStatus ?? "PLAN_TO_WATCH",
    currentEpisode: String(initFlat),
    currentSeason: String(initSE.season),
    currentEpisodeInSeason: String(initSE.episode),
    score: entry?.score != null ? String(entry.score) : "",
    notes: entry?.notes ?? "",
    watchContextPersonId: entry?.watchContextPersonId ? String(entry.watchContextPersonId) : "",
    recommenderId: entry?.recommenderId ? String(entry.recommenderId) : "",
    startedAt: entry?.startedAt ? entry.startedAt.toISOString().split("T")[0] : "",
    completedAt: entry?.completedAt ? entry.completedAt.toISOString().split("T")[0] : "",
  });
  // TODO[TEMP]: verified state — remove after data review
  const [verified, setVerified] = useState(entry?.verified ?? false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function seasonToFlat(season: number, episode: number) {
    if (totalSeasons <= 1) return episode;
    let flat = 0;
    for (let s = 1; s < season; s++) flat += getEpsForSeason(s);
    return flat + episode;
  }

  const isCompleted = form.watchStatus === "COMPLETED";
  const totalEpisodesCount =
    parsedEpsPerSeason.length > 0
      ? parsedEpsPerSeason.slice(0, totalSeasons).reduce((a, b) => a + b, 0)
      : anime.totalEpisodes
      ? totalSeasons * (anime.totalEpisodes ?? 1)
      : null;

  async function save() {
    setSaving(true);
    setMsg("");

    // Compute flat currentEpisode
    let flatEpisode: number;
    if (isCompleted && totalEpisodesCount) {
      flatEpisode = totalEpisodesCount;
    } else if (useSeasonDropdowns) {
      flatEpisode = seasonToFlat(Number(form.currentSeason), Number(form.currentEpisodeInSeason));
    } else {
      flatEpisode = Number(form.currentEpisode);
    }

    await fetch(`/api/anime/${anime.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        watchStatus: form.watchStatus,
        currentEpisode: flatEpisode,
        score: form.score ? Number(form.score) : null,
        notes: form.notes || null,
        watchContextPersonId: form.watchContextPersonId ? Number(form.watchContextPersonId) : null,
        recommenderId: form.recommenderId ? Number(form.recommenderId) : null,
        startedAt: form.startedAt || null,
        completedAt: isCompleted ? (form.completedAt || null) : null,
        verified, // TODO[TEMP]: remove after data review
        ...(anime.source === "MANUAL" && { externalUrl: externalUrl.trim() || null }),
      }),
    });
    setSaving(false);
    setMsg("Saved.");
    router.refresh();
  }

  async function deleteAnime() {
    if (!confirm("Remove this anime from your library?")) return;
    setDeleting(true);
    await fetch(`/api/anime/${anime.id}`, { method: "DELETE" });
    router.push("/library");
    router.refresh();
  }

  async function addToFranchise() {
    if (!newFranchiseId) return;
    await fetch(`/api/franchises/${newFranchiseId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId: anime.id, entryType: newFranchiseEntryType }),
    });
    setAddingFranchise(false);
    setNewFranchiseId("");
    setNewFranchiseEntryType("MAIN");
    router.refresh();
  }

  async function removeFromFranchise(entryId: number) {
    await fetch(`/api/franchise-entries/${entryId}`, { method: "DELETE" });
    router.refresh();
  }

  const joinedFranchiseIds = new Set(anime.franchiseEntries.map((fe) => fe.franchise.id));
  const availableFranchises = franchises.filter((f) => !joinedFranchiseIds.has(f.id));

  return (
    <div className="space-y-4">
      {/* TODO[TEMP]: Verified checkbox — remove after data review */}
      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={verified}
          onChange={(e) => setVerified(e.target.checked)}
          className="w-4 h-4 cursor-pointer accent-green-500"
        />
        <span className={`text-sm font-medium ${verified ? "text-green-400" : "text-slate-400"}`}>
          Verified
        </span>
      </label>

      <div className="grid grid-cols-2 gap-4">
        {/* Row 1: Personal Rating — full width */}
        <div className="col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Personal Rating</label>
          <StarRating
            value={form.score ? Number(form.score) : 0}
            onChange={(v) => set("score", v > 0 ? String(v) : "")}
          />
        </div>

        {/* Row 2: Watch Status | Episode Progress */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Watch Status</label>
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
          {isCompleted ? (
            <div className="w-full bg-slate-800/50 text-slate-500 border border-slate-700 rounded-md px-3 py-2 text-sm cursor-not-allowed">
              {totalEpisodesCount
                ? totalSeasons > 1
                  ? `S${totalSeasons} E${getEpsForSeason(totalSeasons)} (complete)`
                  : `${totalEpisodesCount} / ${totalEpisodesCount} (complete)`
                : "Complete"}
            </div>
          ) : useSeasonDropdowns ? (
            <div className="flex gap-2 items-center">
              <select
                value={form.currentSeason}
                onChange={(e) => {
                  const newSeason = Number(e.target.value);
                  const maxEp = getEpsForSeason(newSeason);
                  const clampedEp = Math.min(Number(form.currentEpisodeInSeason), maxEp);
                  setForm((f) => ({ ...f, currentSeason: e.target.value, currentEpisodeInSeason: String(clampedEp) }));
                }}
                className="flex-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-2 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>S{s}</option>
                ))}
              </select>
              <select
                value={form.currentEpisodeInSeason}
                onChange={(e) => set("currentEpisodeInSeason", e.target.value)}
                className="flex-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-2 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value={0}>E0</option>
                {Array.from({ length: getEpsForSeason(Number(form.currentSeason)) }, (_, i) => i + 1).map((e) => (
                  <option key={e} value={e}>E{e}</option>
                ))}
              </select>
            </div>
          ) : (
            <input
              type="number"
              min={0}
              max={anime.totalEpisodes ?? undefined}
              value={form.currentEpisode}
              onChange={(e) => set("currentEpisode", e.target.value)}
              className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          )}
        </div>

        {/* Row 3: Watch Party | Recommended By */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Watch Party</label>
          <select
            value={form.watchContextPersonId}
            onChange={(e) => set("watchContextPersonId", e.target.value)}
            className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">— None —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Recommended By</label>
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

        {/* Row 4: Start Date | Completed Date */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Start Date</label>
          <input
            type="date"
            value={form.startedAt}
            onChange={(e) => set("startedAt", e.target.value)}
            className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Completed Date</label>
          <input
            type="date"
            value={isCompleted ? form.completedAt : ""}
            onChange={(e) => set("completedAt", e.target.value)}
            disabled={!isCompleted}
            className={`w-full border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none ${
              isCompleted
                ? "bg-slate-800 text-slate-100 focus:border-indigo-500"
                : "bg-slate-800/50 text-slate-500 cursor-not-allowed"
            }`}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Watch Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={4}
          className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      {msg && <p className="text-sm text-green-400">{msg}</p>}

      {anime.source === "MANUAL" && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">External Link</label>
          <input
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://www.themoviedb.org/tv/..."
            className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {/* Franchises */}
      {(anime.franchiseEntries.length > 0 || franchises.length > 0) && (
        <div className="space-y-2 border-t border-slate-800 pt-4">
          <label className="block text-xs text-slate-400 mb-1">Franchises</label>
          {anime.franchiseEntries.map((fe) => (
            <div key={fe.id} className="flex items-center gap-2">
              <a href={`/franchises/${fe.franchise.id}`} className="text-sm text-indigo-400 hover:text-indigo-300 flex-1">
                {fe.franchise.name}
              </a>
              <button
                onClick={() => removeFromFranchise(fe.id)}
                className="text-slate-600 hover:text-red-400 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
          {availableFranchises.length > 0 && (
            addingFranchise ? (
              <div className="flex gap-2 items-center">
                <select
                  value={newFranchiseId}
                  onChange={(e) => setNewFranchiseId(e.target.value)}
                  className="flex-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">— Select franchise —</option>
                  {availableFranchises.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <select
                  value={newFranchiseEntryType}
                  onChange={(e) => setNewFranchiseEntryType(e.target.value)}
                  className="bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="MAIN">Main</option>
                  <option value="SIDE_STORY">Side Story</option>
                  <option value="MOVIE">Movie</option>
                  <option value="OVA">OVA</option>
                </select>
                <button onClick={addToFranchise} disabled={!newFranchiseId} className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 rounded-md disabled:opacity-50">Add</button>
                <button onClick={() => { setAddingFranchise(false); setNewFranchiseId(""); }} className="text-sm text-slate-400 hover:text-white">✕</button>
              </div>
            ) : (
              <button
                onClick={() => setAddingFranchise(true)}
                className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 px-2 py-1 rounded transition-colors"
              >
                + Add to franchise
              </button>
            )
          )}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

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
