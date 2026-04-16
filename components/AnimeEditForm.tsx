"use client";

import { useState, useEffect } from "react";
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

type LinkedAnimeSeason = {
  order: number;
  anime: {
    id: number;
    titleRomaji: string;
    titleEnglish: string | null;
    totalEpisodes: number | null;
    totalSeasons: number | null;
    episodesPerSeason: string | null;
    tmdbId: number | null;
  };
};

type Props = {
  anime: Anime & {
    franchiseEntries: { id: number; franchise: { id: number; name: string } }[];
  };
  entry: UserEntry & { recommender: Person | null; watchContextPerson: Person | null } | null;
  people: Person[];
  franchises: Franchise[];
  // All linked anime in order (from Link.linkedAnime); undefined for standalone
  linkedAnime?: LinkedAnimeSeason[];
};

export default function AnimeEditForm({ anime, entry, people, franchises, linkedAnime }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [addingFranchise, setAddingFranchise] = useState(false);
  const [newFranchiseId, setNewFranchiseId] = useState("");
  const [newFranchiseEntryType, setNewFranchiseEntryType] = useState("MAIN");


  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false);

  // Season/episode helpers — derived from prop (updates after router.refresh())
  // If there are multiple linked anime, each is treated as one virtual "season".
  // For a standalone anime (or a link of 1), use the anime's own episodesPerSeason.
  const linkedSorted = (linkedAnime ?? []).slice().sort((a, b) => a.order - b.order);
  const isMultiLink = linkedSorted.length > 1;

  let virtualEpsPerSeason: number[];
  let seasonLabels: string[];

  if (isMultiLink) {
    // Each linked anime = one virtual season
    virtualEpsPerSeason = linkedSorted.map((la) => la.anime.totalEpisodes ?? 1);
    seasonLabels = linkedSorted.map((la, i) =>
      la.anime.titleEnglish ?? la.anime.titleRomaji ?? `Season ${i + 1}`
    );
  } else {
    // Single anime: use its own episodesPerSeason breakdown
    const parsedEpsPerSeason: number[] = anime.episodesPerSeason
      ? JSON.parse(anime.episodesPerSeason)
      : [];
    const totalSeasons = Math.max(1, anime.totalSeasons ?? 1);
    const eps: number[] = parsedEpsPerSeason.length > 0
      ? parsedEpsPerSeason.slice(0, totalSeasons)
      : Array.from({ length: totalSeasons }, () => Math.ceil((anime.totalEpisodes ?? 0) / totalSeasons) || 1);
    virtualEpsPerSeason = eps;
    seasonLabels = eps.map((_, i) => `Season ${i + 1}`);
  }

  const virtualTotalSeasons = Math.max(1, virtualEpsPerSeason.length);
  const getEpsForSeason = (season: number) => virtualEpsPerSeason[season - 1] ?? 1;

  const useSeasonDropdowns = virtualTotalSeasons > 1 || !!(anime.totalEpisodes);

  // Convert flat episode index → { season, episode }
  const flatToSE = (flat: number) => {
    if (virtualTotalSeasons <= 1 || flat === 0) return { season: 1, episode: flat };
    let remaining = flat;
    for (let s = 1; s <= virtualTotalSeasons; s++) {
      const sEps = getEpsForSeason(s);
      if (remaining <= sEps || s === virtualTotalSeasons) return { season: s, episode: remaining };
      remaining -= sEps;
    }
    return { season: 1, episode: flat };
  };

  const initFlat = entry?.currentEpisode ?? 0;
  const initSE = flatToSE(initFlat);

  const [externalUrl, setExternalUrl] = useState(anime.externalUrl ?? "");

  const [form, setForm] = useState({
    watchStatus: entry?.watchStatus ?? "",
    currentEpisode: String(initFlat),
    currentSeason: String(initSE.season),
    currentEpisodeInSeason: String(initSE.episode),
    score: entry?.score != null ? String(entry.score) : "",
    notes: entry?.notes ?? "",
    watchContextPersonId: entry?.watchContextPersonId ? String(entry.watchContextPersonId) : "",
    recommenderId: entry?.recommenderId ? String(entry.recommenderId) : "",
    discoveryType: entry?.discoveryType ?? "",
    discoverySource: entry?.discoverySource ?? "",
    startedAt: entry?.startedAt ? entry.startedAt.toISOString().split("T")[0] : "",
    completedAt: entry?.completedAt ? entry.completedAt.toISOString().split("T")[0] : "",
  });
  const [sourceSuggestions, setSourceSuggestions] = useState<string[]>([]);
  const [episodeNames, setEpisodeNames] = useState<Record<number, { number: number; name: string }[]>>({});

  useEffect(() => {
    fetch("/api/discovery-sources")
      .then((r) => r.json())
      .then((d) => setSourceSuggestions(d.sources ?? []));
  }, []);

  // Fetch episode names from TMDB for the current season.
  // In multi-link mode, pass episodeOffset+episodeCount so the server can map the virtual
  // season to the correct TMDB season (handles both "all-in-season-1" and multi-season cases).
  useEffect(() => {
    const season = Number(form.currentSeason);
    if (episodeNames[season] !== undefined) return;

    const anchorId = isMultiLink ? (linkedSorted[0]?.anime.id ?? anime.id) : anime.id;

    const fetchEps = async (): Promise<{ number: number; name: string }[]> => {
      const params = new URLSearchParams();
      if (isMultiLink || virtualTotalSeasons > 1) {
        const offset = virtualEpsPerSeason.slice(0, season - 1).reduce((a, b) => a + b, 0);
        const count = virtualEpsPerSeason[season - 1] ?? 0;
        params.set("episodeOffset", String(offset));
        params.set("episodeCount", String(count));
      }
      const qs = params.toString();
      const d = await fetch(`/api/anime/${anchorId}/season/${season}${qs ? `?${qs}` : ""}`).then((r) => r.json()) as { episodes?: { number: number; name: string }[] };
      return d.episodes ?? [];
    };

    fetchEps()
      .then((eps) => setEpisodeNames((prev) => ({ ...prev, [season]: eps })))
      .catch(() => setEpisodeNames((prev) => ({ ...prev, [season]: [] })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.currentSeason, anime.id]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function setDiscoveryType(type: string) {
    const updates = {
      discoveryType: type,
      recommenderId: type === "PERSONAL" ? form.recommenderId : "",
      discoverySource: (type === "PLATFORM" || type === "OTHER") ? form.discoverySource : "",
    };
    setForm((f) => ({ ...f, ...updates }));
    return updates;
  }

  function checkCompletionPrompt(overrides: Partial<typeof form> = {}) {
    const f = { ...form, ...overrides };
    if (!canBeCompleted || f.watchStatus === "COMPLETED" || !f.watchStatus) return;
    let atLastEpisode: boolean;
    if (useSeasonDropdowns) {
      const season = Number(f.currentSeason);
      const ep = Number(f.currentEpisodeInSeason);
      atLastEpisode = season === virtualTotalSeasons && ep === getEpsForSeason(virtualTotalSeasons);
    } else {
      atLastEpisode = totalEpisodesCount !== null && Number(f.currentEpisode) >= totalEpisodesCount;
    }
    if (atLastEpisode) setShowCompletionPrompt(true);
  }

  function seasonToFlat(season: number, episode: number) {
    if (virtualTotalSeasons <= 1) return episode;
    let flat = 0;
    for (let s = 1; s < season; s++) flat += getEpsForSeason(s);
    return flat + episode;
  }

  const isCompleted = form.watchStatus === "COMPLETED";
  const canBeCompleted = anime.airingStatus === "FINISHED" || anime.airingStatus === "CANCELLED" || anime.airingStatus === "HIATUS";
  const totalEpisodesCount = virtualEpsPerSeason.length > 0
    ? virtualEpsPerSeason.reduce((a, b) => a + b, 0)
    : null;

  async function save(formOverrides: Partial<typeof form> = {}, euOverride?: string) {
    const f = { ...form, ...formOverrides };
    if (!f.watchStatus) return; // No status selected yet — don't create an entry
    const eu = euOverride ?? externalUrl;
    const isComp = f.watchStatus === "COMPLETED";

    setSaveStatus("saving");

    // Compute flat currentEpisode
    let flatEpisode: number;
    if (isComp && totalEpisodesCount) {
      flatEpisode = totalEpisodesCount;
    } else if (useSeasonDropdowns) {
      flatEpisode = seasonToFlat(Number(f.currentSeason), Number(f.currentEpisodeInSeason));
    } else {
      flatEpisode = Number(f.currentEpisode);
    }

    await fetch(`/api/anime/${anime.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        watchStatus: f.watchStatus,
        currentEpisode: flatEpisode,
        score: f.score ? Number(f.score) : null,
        notes: f.notes || null,
        watchContextPersonId: f.watchContextPersonId ? Number(f.watchContextPersonId) : null,
        recommenderId: f.discoveryType === "PERSONAL" && f.recommenderId ? Number(f.recommenderId) : null,
        discoveryType: f.discoveryType || null,
        discoverySource: (f.discoveryType === "PLATFORM" || f.discoveryType === "OTHER") ? f.discoverySource || null : null,
        startedAt: f.startedAt || null,
        completedAt: isComp ? (f.completedAt || null) : null,
        ...(anime.source === "MANUAL" && { externalUrl: eu.trim() || null }),
      }),
    });
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
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
      <div className="grid grid-cols-2 gap-4">
        {/* Row 1: Personal Rating — full width */}
        <div className="col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Personal Rating</label>
          <StarRating
            value={form.score ? Number(form.score) : 0}
            onChange={(v) => { const s = v > 0 ? String(v) : ""; set("score", s); save({ score: s }); }}
          />
        </div>

        {/* Row 2: Watch Status | Episode Progress */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Watch Status</label>
          <select
            value={form.watchStatus}
            onChange={(e) => {
              const newStatus = e.target.value;
              if (newStatus === "PLAN_TO_WATCH") {
                const episodeFlat = useSeasonDropdowns
                  ? seasonToFlat(Number(form.currentSeason), Number(form.currentEpisodeInSeason))
                  : Number(form.currentEpisode);
                if (episodeFlat > 0) {
                  if (!confirm("Changing to Plan to Watch will clear your episode progress. Continue?")) return;
                  const cleared = { watchStatus: "PLAN_TO_WATCH" as const, currentEpisode: "0", currentSeason: "1", currentEpisodeInSeason: "0" };
                  setForm((f) => ({ ...f, ...cleared }));
                  save(cleared);
                  return;
                }
              }
              set("watchStatus", newStatus);
              save({ watchStatus: newStatus as typeof form.watchStatus });
            }}
            className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            {!entry && <option value="" disabled>— Select status —</option>}
            <option value="PLAN_TO_WATCH">Plan to Watch</option>
            <option value="WATCHING">Watching</option>
            <option value="COMPLETED" disabled={!canBeCompleted}>
              {canBeCompleted ? "Completed" : "Completed (series not finished)"}
            </option>
            <option value="DROPPED">Dropped</option>
            <option value="NOT_INTERESTED">Not Interested</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Last Completed Episode</label>
          {isCompleted ? (
            <div className="w-full bg-slate-800/50 text-slate-500 border border-slate-700 rounded-md px-3 py-2 text-sm cursor-not-allowed">
              {totalEpisodesCount
                ? virtualTotalSeasons > 1
                  ? `${seasonLabels[virtualTotalSeasons - 1]} · Ep ${getEpsForSeason(virtualTotalSeasons)} (complete)`
                  : `${totalEpisodesCount} / ${totalEpisodesCount} (complete)`
                : "Complete"}
            </div>
          ) : useSeasonDropdowns ? (
            <div className="space-y-2">
              <select
                value={form.currentSeason}
                onChange={(e) => {
                  const newSeason = Number(e.target.value);
                  const maxEp = getEpsForSeason(newSeason);
                  const clampedEp = Math.min(Number(form.currentEpisodeInSeason), maxEp);
                  const updates = { currentSeason: e.target.value, currentEpisodeInSeason: String(clampedEp) };
                  setForm((f) => ({ ...f, ...updates }));
                  save(updates);
                  checkCompletionPrompt(updates);
                }}
                className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-2 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                {seasonLabels.map((label, i) => (
                  <option key={i + 1} value={i + 1}>{label}</option>
                ))}
              </select>
              <select
                value={form.currentEpisodeInSeason}
                onChange={(e) => {
                  const updates: Partial<typeof form> = { currentEpisodeInSeason: e.target.value };
                  if (Number(e.target.value) > 0 && form.watchStatus === "PLAN_TO_WATCH") {
                    updates.watchStatus = "WATCHING";
                  }
                  setForm((f) => ({ ...f, ...updates }));
                  save(updates);
                  checkCompletionPrompt(updates);
                }}
                className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-2 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value={0}>None</option>
                {Array.from({ length: getEpsForSeason(Number(form.currentSeason)) }, (_, i) => i + 1).map((ep) => {
                  const title = episodeNames[Number(form.currentSeason)]?.find((e) => e.number === ep)?.name;
                  return (
                    <option key={ep} value={ep}>
                      {title ? `Ep ${ep} – ${title}` : `Ep ${ep}`}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <input
              type="number"
              min={0}
              max={anime.totalEpisodes ?? undefined}
              value={form.currentEpisode}
              onChange={(e) => set("currentEpisode", e.target.value)}
              onBlur={() => {
                const updates: Partial<typeof form> = {};
                if (Number(form.currentEpisode) > 0 && form.watchStatus === "PLAN_TO_WATCH") {
                  updates.watchStatus = "WATCHING";
                  setForm((f) => ({ ...f, ...updates }));
                }
                save(updates);
                checkCompletionPrompt(updates);
              }}
              className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          )}
        </div>

        {/* Row 3: Watch Party | How did you find this? */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Watch Party</label>
          <select
            value={form.watchContextPersonId}
            onChange={(e) => { set("watchContextPersonId", e.target.value); save({ watchContextPersonId: e.target.value }); }}
            className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">Personal Enjoyment</option>
            {people.length > 0 && <option disabled>────────────</option>}
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">How did you find this?</label>
          <div className="flex flex-wrap gap-1 mb-2">
            {([
              { value: "", label: "—" },
              { value: "PERSONAL", label: "Personal" },
              { value: "PLATFORM", label: "Platform" },
              { value: "OTHER", label: "Other" },
              { value: "UNKNOWN", label: "Don't remember" },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => { const updates = setDiscoveryType(value); save(updates); }}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  form.discoveryType === value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {form.discoveryType === "PERSONAL" && (
            <select
              value={form.recommenderId}
              onChange={(e) => { set("recommenderId", e.target.value); save({ recommenderId: e.target.value }); }}
              className="w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Select person —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {form.discoveryType === "PLATFORM" && (
            <>
              <input
                list="discovery-source-suggestions"
                value={form.discoverySource}
                onChange={(e) => set("discoverySource", e.target.value)}
                onBlur={() => save()}
                placeholder="e.g. Netflix, TikTok..."
                className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
              <datalist id="discovery-source-suggestions">
                {sourceSuggestions.map((s) => <option key={s} value={s} />)}
              </datalist>
            </>
          )}
          {form.discoveryType === "OTHER" && (
            <input
              value={form.discoverySource}
              onChange={(e) => set("discoverySource", e.target.value)}
              onBlur={() => save()}
              placeholder="Describe..."
              className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          )}
        </div>

        {/* Row 4: Start Date | Completed Date */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Start Date</label>
          <input
            type="date"
            value={form.startedAt}
            onChange={(e) => set("startedAt", e.target.value)}
            onBlur={() => save()}
            className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Completed Date</label>
          <input
            type="date"
            value={isCompleted ? form.completedAt : ""}
            onChange={(e) => set("completedAt", e.target.value)}
            onBlur={() => save()}
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
          onBlur={() => save()}
          rows={4}
          className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      {anime.source === "MANUAL" && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">External Link</label>
          <input
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            onBlur={(e) => save({}, e.target.value)}
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
                suppressHydrationWarning
              >
                ✕
              </button>
            </div>
          ))}
          {availableFranchises.length > 0 && anime.franchiseEntries.length === 0 && (
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

      <div className="flex gap-3 flex-wrap items-center">
        {saveStatus === "saving" && <span className="text-xs text-slate-500">Saving…</span>}
        {saveStatus === "saved" && <span className="text-xs text-green-500">Saved</span>}

        <button
          onClick={deleteAnime}
          disabled={deleting}
          className="ml-auto px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 rounded-md transition-colors disabled:opacity-50"
          suppressHydrationWarning
        >
          Remove
        </button>
      </div>

      {showCompletionPrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-xl">
            <h3 className="text-white font-semibold text-lg">All caught up?</h3>
            <p className="text-slate-300 text-sm">
              You&apos;ve reached the last episode
              {canBeCompleted ? " and this series has finished airing" : ""}.
              {" "}Would you like to mark it as <span className="text-green-400 font-medium">Completed</span>?
            </p>
            {!form.score && (
              <p className="text-yellow-400 text-sm font-medium">
                ★ Don&apos;t forget to give it a rating!
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCompletionPrompt(false);
                  const updates = { watchStatus: "COMPLETED" as const };
                  setForm((f) => ({ ...f, ...updates }));
                  save(updates);
                }}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm py-2 rounded-md transition-colors font-medium"
              >
                Mark as Completed
              </button>
              <button
                onClick={() => setShowCompletionPrompt(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2 rounded-md border border-slate-600 transition-colors"
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
