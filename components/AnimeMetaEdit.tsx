"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Anime } from "@/app/generated/prisma";
import type { AniListAnime } from "@/lib/anilist";

type LinkResult = Pick<AniListAnime, "id" | "title" | "coverImage" | "season" | "seasonYear" | "episodes">;

type Props = {
  anime: Pick<
    Anime,
    | "id"
    | "source"
    | "anilistId"
    | "tmdbId"
    | "tmdbMediaType"
    | "titleEnglish"
    | "synopsis"
    | "airingStatus"
    | "displayFormat"
    | "totalEpisodes"
    | "totalSeasons"
    | "season"
    | "seasonYear"
    | "genres"
  >;
};

function parseTmdbInput(input: string): { id: number; mediaType: "tv" | "movie" } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/themoviedb\.org\/(tv|movie)\/(\d+)/);
  if (urlMatch) return { id: Number(urlMatch[2]), mediaType: urlMatch[1] as "tv" | "movie" };
  const num = Number(trimmed);
  if (!isNaN(num) && num > 0) return { id: num, mediaType: "tv" };
  return null;
}

export default function AnimeMetaEdit({ anime }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isAniList = !!anime.anilistId;

  const [form, setForm] = useState({
    titleEnglish: anime.titleEnglish ?? "",
    synopsis: anime.synopsis ?? "",
    airingStatus: anime.airingStatus ?? "FINISHED",
    displayFormat: anime.displayFormat ?? "SERIES",
    totalEpisodes: anime.totalEpisodes != null ? String(anime.totalEpisodes) : "",
    totalSeasons: anime.totalSeasons != null ? String(anime.totalSeasons) : "",
    season: anime.season ?? "",
    seasonYear: anime.seasonYear != null ? String(anime.seasonYear) : "",
    genres: anime.genres ? (JSON.parse(anime.genres) as string[]).join(", ") : "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // TMDB state
  const [tmdbInput, setTmdbInput] = useState("");
  const [tmdbSaving, setTmdbSaving] = useState(false);
  const [tmdbMsg, setTmdbMsg] = useState("");

  // AniList link state
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<LinkResult[]>([]);
  const [linkSelected, setLinkSelected] = useState<LinkResult | null>(null);
  const [linkSearching, setLinkSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState("");
  const [unlinking, setUnlinking] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/anime/${anime.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Only send AniList-managed fields for MANUAL entries
        ...(!isAniList && {
          titleEnglish: form.titleEnglish.trim() || null,
          synopsis: form.synopsis.trim() || null,
          airingStatus: form.airingStatus,
          displayFormat: form.displayFormat,
          totalEpisodes: form.totalEpisodes ? Number(form.totalEpisodes) : null,
          season: form.season || null,
          seasonYear: form.seasonYear ? Number(form.seasonYear) : null,
          genres: JSON.stringify(form.genres.split(",").map((g) => g.trim()).filter(Boolean)),
        }),
        // totalSeasons is TMDB-derived — editable for all
        totalSeasons: form.totalSeasons ? Number(form.totalSeasons) : null,
      }),
    });
    setSaving(false);
    if (!isAniList) setOpen(false);
    router.refresh();
  }

  async function saveTmdb() {
    const parsed = parseTmdbInput(tmdbInput);
    if (!parsed) { setTmdbMsg("Enter a TMDB URL or numeric ID"); return; }
    setTmdbSaving(true);
    setTmdbMsg("");
    await fetch(`/api/anime/${anime.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId: parsed.id, tmdbMediaType: parsed.mediaType }),
    });
    setTmdbSaving(false);
    setTmdbInput("");
    router.refresh();
  }

  async function clearTmdb() {
    setTmdbSaving(true);
    await fetch(`/api/anime/${anime.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId: null, tmdbMediaType: null }),
    });
    setTmdbSaving(false);
    router.refresh();
  }

  async function searchForLink() {
    if (linkQuery.trim().length < 2) return;
    setLinkSearching(true);
    setLinkMsg("");
    setLinkResults([]);
    setLinkSelected(null);
    const res = await fetch(`/api/anilist/search?q=${encodeURIComponent(linkQuery.trim())}`);
    const data: LinkResult[] = res.ok ? await res.json() : [];
    setLinkResults(data);
    setLinkSearching(false);
  }

  async function linkToAniList() {
    if (!linkSelected) return;
    setLinking(true);
    setLinkMsg("");
    const res = await fetch(`/api/anime/${anime.id}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anilistId: linkSelected.id }),
    });
    if (res.ok) {
      setLinkMsg("Linked and synced with AniList.");
      router.refresh();
    } else {
      const err = await res.json();
      setLinkMsg(err.error ?? "Link failed.");
    }
    setLinking(false);
  }

  async function unlinkAniList() {
    if (!confirm("Unlink from AniList? Metadata will stay but won't auto-sync.")) return;
    setUnlinking(true);
    await fetch(`/api/anime/${anime.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anilistId: null, source: "MANUAL" }),
    });
    setUnlinking(false);
    router.refresh();
  }

  const inputCls = "w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500";
  const disabledCls = "w-full bg-slate-800/40 text-slate-500 border border-slate-700/50 rounded-md px-3 py-2 text-sm cursor-not-allowed";
  const selectCls = "w-full bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500";
  const disabledSelectCls = "w-full bg-slate-800/40 text-slate-500 border border-slate-700/50 rounded-md px-3 py-2 text-sm cursor-not-allowed";

  // Always-visible TMDB status row
  const tmdbRow = (
    <div className="flex items-center gap-2 flex-wrap text-xs mt-1">
      <span className="text-slate-500">TMDB:</span>
      {anime.tmdbId ? (
        <>
          <a
            href={`https://www.themoviedb.org/${anime.tmdbMediaType ?? "tv"}/${anime.tmdbId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            #{anime.tmdbId} ({anime.tmdbMediaType ?? "tv"}) ↗
          </a>
          <button
            onClick={clearTmdb}
            disabled={tmdbSaving}
            className="text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {tmdbSaving ? "clearing…" : "clear"}
          </button>
        </>
      ) : (
        <>
          <span className="text-slate-600">not linked</span>
          <input
            value={tmdbInput}
            onChange={(e) => { setTmdbInput(e.target.value); setTmdbMsg(""); }}
            onKeyDown={(e) => e.key === "Enter" && saveTmdb()}
            placeholder="URL or ID"
            className="w-28 bg-slate-800 text-slate-100 border border-slate-700 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={saveTmdb}
            disabled={tmdbSaving || !tmdbInput.trim()}
            className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors disabled:opacity-50"
          >
            {tmdbSaving ? "…" : "Set"}
          </button>
          {tmdbMsg && <span className="text-red-400">{tmdbMsg}</span>}
        </>
      )}
    </div>
  );

  if (!open) {
    return (
      <div className="mt-1 space-y-1">
        {tmdbRow}
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          Edit details
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {tmdbRow}
      <div className="border border-slate-700 rounded-md p-4 space-y-4">
      {/* Metadata fields */}
      <div className="space-y-3">
        {isAniList && (
          <p className="text-xs text-slate-500 italic">Fields below are managed by AniList and will be overwritten on sync.</p>
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1">English Title</label>
          <input
            type="text"
            value={form.titleEnglish}
            onChange={(e) => set("titleEnglish", e.target.value)}
            disabled={isAniList}
            placeholder="English title (if different from main title)"
            className={isAniList ? disabledCls : inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={form.airingStatus}
              onChange={(e) => set("airingStatus", e.target.value)}
              disabled={isAniList}
              className={isAniList ? disabledSelectCls : selectCls}
            >
              <option value="FINISHED">Finished</option>
              <option value="RELEASING">Releasing</option>
              <option value="HIATUS">Hiatus</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NOT_YET_RELEASED">Not Yet Released</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Format</label>
            <select
              value={form.displayFormat}
              onChange={(e) => set("displayFormat", e.target.value)}
              disabled={isAniList}
              className={isAniList ? disabledSelectCls : selectCls}
            >
              <option value="SERIES">Series</option>
              <option value="MOVIE">Movie</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Total Episodes</label>
            <input
              type="number"
              min={1}
              value={form.totalEpisodes}
              onChange={(e) => set("totalEpisodes", e.target.value)}
              disabled={isAniList}
              placeholder="—"
              className={isAniList ? disabledCls : inputCls}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Total Seasons</label>
            <input
              type="number"
              min={1}
              value={form.totalSeasons}
              onChange={(e) => set("totalSeasons", e.target.value)}
              placeholder="—"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Season</label>
            <select
              value={form.season}
              onChange={(e) => set("season", e.target.value)}
              disabled={isAniList}
              className={isAniList ? disabledSelectCls : selectCls}
            >
              <option value="">— Unknown —</option>
              <option value="WINTER">Winter</option>
              <option value="SPRING">Spring</option>
              <option value="SUMMER">Summer</option>
              <option value="FALL">Fall</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Year</label>
            <input
              type="number"
              min={1900}
              max={2100}
              value={form.seasonYear}
              onChange={(e) => set("seasonYear", e.target.value)}
              disabled={isAniList}
              placeholder="—"
              className={isAniList ? disabledCls : inputCls}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Genres <span className="text-slate-600">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={form.genres}
            onChange={(e) => set("genres", e.target.value)}
            disabled={isAniList}
            placeholder="Action, Adventure, Fantasy"
            className={isAniList ? disabledCls : inputCls}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Synopsis</label>
          <textarea
            value={form.synopsis}
            onChange={(e) => set("synopsis", e.target.value)}
            disabled={isAniList}
            rows={5}
            placeholder="Series description..."
            className={`${isAniList ? disabledCls : inputCls} resize-none`}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* AniList link */}
      <div className="border-t border-slate-700/50 pt-4 space-y-2">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">AniList Link</p>
        {anime.anilistId ? (
          <div className="flex items-center gap-3">
            <a
              href={`https://anilist.co/anime/${anime.anilistId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              #{anime.anilistId} ↗
            </a>
            <button
              onClick={unlinkAniList}
              disabled={unlinking}
              className="text-xs text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {unlinking ? "Unlinking..." : "Unlink"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-600">Not linked</p>
            <div className="flex gap-2">
              <input
                value={linkQuery}
                onChange={(e) => setLinkQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchForLink()}
                placeholder="Search AniList..."
                className="flex-1 bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={searchForLink}
                disabled={linkSearching || linkQuery.trim().length < 2}
                className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors disabled:opacity-50"
              >
                {linkSearching ? "Searching..." : "Search"}
              </button>
            </div>

            {linkResults.length > 0 && (
              <ul className="max-h-56 overflow-y-auto space-y-1">
                {linkResults.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setLinkSelected(linkSelected?.id === r.id ? null : r)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                        linkSelected?.id === r.id
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                      }`}
                    >
                      {r.coverImage?.large && (
                        <img src={r.coverImage.large} alt="" className="w-8 h-12 object-cover rounded flex-shrink-0" />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium">{r.title.romaji}</span>
                        {r.title.english && r.title.english !== r.title.romaji && (
                          <span className="block truncate text-xs opacity-70">{r.title.english}</span>
                        )}
                        <span className="block text-xs opacity-60">
                          {[r.season, r.seasonYear, r.episodes ? `${r.episodes} eps` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="text-xs opacity-50 flex-shrink-0">#{r.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {linkSelected && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-300 truncate">
                  Selected: <span className="text-white font-medium">{linkSelected.title.romaji}</span>
                </p>
                <button
                  onClick={linkToAniList}
                  disabled={linking}
                  className="flex-shrink-0 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  {linking ? "Linking..." : "Confirm Link"}
                </button>
              </div>
            )}

            {linkMsg && (
              <p className={`text-sm ${linkMsg.startsWith("Linked") ? "text-green-400" : "text-red-400"}`}>
                {linkMsg}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
