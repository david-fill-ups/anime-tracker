export const dynamic = "force-dynamic";
import React from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ScoreByYearScatter } from "@/components/ScoreByYearScatter";

// Statuses that represent genuine watch engagement (excludes wishlist/recommendations)
const ENGAGED_STATUSES = ["WATCHING", "COMPLETED", "DROPPED"] as const;
type EngagedStatus = typeof ENGAGED_STATUSES[number];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [links, engagedAnimes] = await Promise.all([
    db.link.findMany({
      where: { userId, userEntry: { isNot: null } },
      include: {
        userEntry: true,
        linkedAnime: {
          where: { order: 0 },
          include: {
            anime: {
              include: { animeStudios: { include: { studio: true }, where: { isMainStudio: true } } },
            },
          },
          take: 1,
        },
      },
    }),
    // Only primary anime the user has actually engaged with for genre/format/studio stats
    db.anime.findMany({
      where: {
        linkedIn: { some: { order: 0, link: { userId, userEntry: { is: { watchStatus: { in: ENGAGED_STATUSES as unknown as EngagedStatus[] } } } } } },
      },
    }),
  ]);

  const entries = links
    .filter((l) => l.userEntry && l.linkedAnime[0]?.anime)
    .map((l) => ({ ...l.userEntry!, anime: l.linkedAnime[0].anime }));

  // Status breakdown (all statuses, for the library breakdown bar chart)
  const statusCounts: Record<string, number> = {};
  for (const e of entries) {
    statusCounts[e.watchStatus] = (statusCounts[e.watchStatus] ?? 0) + 1;
  }

  // Total hours watched (completed + watching only)
  const activeEntries = entries.filter(
    (e) => e.watchStatus === "COMPLETED" || e.watchStatus === "WATCHING"
  );
  const totalMinutes = activeEntries.reduce((sum, e) => {
    const mins = e.anime.durationMins ?? 24;
    return sum + mins * e.currentEpisode;
  }, 0);
  const totalHours = Math.round(totalMinutes / 60);

  // Avg score — engaged entries only (excludes wishlist/recommendations)
  const engagedStatuses = new Set<string>(ENGAGED_STATUSES);
  const rated = entries.filter((e) => e.score != null && engagedStatuses.has(e.watchStatus));
  const avgScore = rated.length
    ? Math.round((rated.reduce((s, e) => s + (e.score ?? 0), 0) / rated.length) * 10) / 10
    : null;

  // Genre breakdown — engaged anime only
  const genreCounts: Record<string, number> = {};
  for (const anime of engagedAnimes) {
    const genres: string[] = JSON.parse(anime.genres || "[]");
    for (const g of genres) {
      genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    }
  }
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Studio scores — hours-weighted avg (weight = episodes watched × duration)
  const studioScores: Record<string, { weightedSum: number; totalWeight: number; count: number }> = {};
  for (const e of rated) {
    const studio = e.anime.animeStudios[0]?.studio.name;
    if (studio) {
      const weight = e.currentEpisode * (e.anime.durationMins ?? 24);
      if (!studioScores[studio]) studioScores[studio] = { weightedSum: 0, totalWeight: 0, count: 0 };
      studioScores[studio].weightedSum += (e.score ?? 0) * weight;
      studioScores[studio].totalWeight += weight;
      studioScores[studio].count += 1;
    }
  }
  const topStudios = Object.entries(studioScores)
    .filter(([, v]) => v.count >= 2 && v.totalWeight > 0)
    .map(([name, v]) => ({ name, avg: Math.round((v.weightedSum / v.totalWeight) * 10) / 10, count: v.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  // Genre ratings — avg score per genre, engaged rated entries only
  const genreScores: Record<string, { sum: number; count: number }> = {};
  for (const e of rated) {
    const genres: string[] = JSON.parse(e.anime.genres || "[]");
    for (const g of genres) {
      if (!genreScores[g]) genreScores[g] = { sum: 0, count: 0 };
      genreScores[g].sum += e.score!;
      genreScores[g].count += 1;
    }
  }
  const genreRatings = Object.entries(genreScores)
    .filter(([, v]) => v.count >= 2)
    .map(([genre, v]) => ({ genre, avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count }))
    .sort((a, b) => b.avg - a.avg);

  // Your taste vs community — normalize user score (1–5) to 0–100 for comparison
  const scoredWithCommunity = rated.filter((e) => (e.anime.meanScore ?? 0) > 0);
  const avgUserNorm = scoredWithCommunity.length
    ? Math.round(scoredWithCommunity.reduce((s, e) => s + (e.score! / 5) * 100, 0) / scoredWithCommunity.length)
    : null;
  const avgCommunity = scoredWithCommunity.length
    ? Math.round(scoredWithCommunity.reduce((s, e) => s + e.anime.meanScore!, 0) / scoredWithCommunity.length)
    : null;
  const scoreDelta = avgUserNorm != null && avgCommunity != null ? avgUserNorm - avgCommunity : null;

  // Score by release year — scatter data (nulls filtered out)
  const scatterData = rated
    .filter((e) => e.anime.seasonYear != null)
    .map((e) => ({
      year: e.anime.seasonYear!,
      score: e.score!,
      title: e.anime.titleEnglish || e.anime.titleRomaji || "Unknown",
    }));

  // Format breakdown — engaged anime only
  const formatCounts: Record<string, number> = {};
  for (const a of engagedAnimes) formatCounts[a.displayFormat] = (formatCounts[a.displayFormat] ?? 0) + 1;

  const STATUS_LABELS: Record<string, string> = {
    WATCHING: "Watching",
    COMPLETED: "Completed",
    DROPPED: "Dropped",
    PLAN_TO_WATCH: "Plan to Watch",
  };

  const STATUS_COLORS: Record<string, string> = {
    WATCHING: "bg-blue-500",
    COMPLETED: "bg-green-500",
    DROPPED: "bg-red-500",
    PLAN_TO_WATCH: "bg-purple-500",
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
      </div>

      {/* Top-line numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Watched" value={String(engagedAnimes.length)} href="/library" />
        <StatCard label="Completed" value={String(statusCounts["COMPLETED"] ?? 0)} href="/library?status=COMPLETED" />
        <StatCard label="Hours Watched" value={formatWatchTime(totalMinutes)} title={`${totalHours.toLocaleString()} hours watched`} href="/library" />
        <StatCard
          label="Avg Score"
          value={avgScore != null ? `${avgScore} / 5` : "—"}
          href="/library?sort=score"
          subtitle={avgScore != null ? <Stars score={avgScore} /> : undefined}
        />
      </div>

      {/* Status breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Library Breakdown</h3>
        <div className="space-y-2">
          {Object.entries(statusCounts).map(([status, count]) => {
            const pct = Math.round((count / entries.length) * 100);
            return (
              <Link
                key={status}
                href={`/library?status=${status}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 hover:bg-slate-800/60 transition-colors"
              >
                <span className="text-sm text-slate-400 w-32">{STATUS_LABELS[status] ?? status}</span>
                <div className="flex-1 bg-slate-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${STATUS_COLORS[status] ?? "bg-slate-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm text-slate-400 w-12 text-right">{count}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Top genres */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Top Genres</h3>
        {topGenres.length === 0 ? (
          <p className="text-slate-500 text-sm">No genre data yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {topGenres.map(([genre, count]) => (
              <Link
                key={genre}
                href={`/library?genre=${encodeURIComponent(genre)}`}
                className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2 hover:bg-slate-700 transition-colors"
              >
                <span className="text-sm text-slate-300">{genre}</span>
                <span className="text-sm font-medium text-white">{count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Studio scores */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Studio Ratings</h3>
        <p className="text-xs text-slate-500 mb-4">Hours-weighted avg · ≥2 rated entries</p>
        {topStudios.length === 0 ? (
          <p className="text-slate-500 text-sm">Rate more anime to see studio comparisons.</p>
        ) : (
          <div className="space-y-2">
            {topStudios.map((s) => (
              <Link
                key={s.name}
                href={`/library?studio=${encodeURIComponent(s.name)}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 hover:bg-slate-800/60 transition-colors"
              >
                <span className="text-sm text-slate-300 flex-1">{s.name}</span>
                <span className="text-xs text-slate-500">{s.count} anime</span>
                <span className="text-sm font-medium text-yellow-400">★ {s.avg}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Genre ratings */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Genre Ratings</h3>
        <p className="text-xs text-slate-500 mb-4">Avg score · ≥2 rated entries</p>
        {genreRatings.length === 0 ? (
          <p className="text-slate-500 text-sm">Rate more anime to see genre comparisons.</p>
        ) : (
          <div className="space-y-2">
            {genreRatings.map((g) => (
              <Link
                key={g.genre}
                href={`/library?genre=${encodeURIComponent(g.genre)}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 hover:bg-slate-800/60 transition-colors"
              >
                <span className="text-sm text-slate-300 flex-1">{g.genre}</span>
                <span className="text-xs text-slate-500">{g.count} anime</span>
                <span className="text-sm font-medium text-yellow-400">★ {g.avg}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Your taste vs community */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Your Taste vs Community</h3>
        {avgUserNorm == null ? (
          <p className="text-slate-500 text-sm">Rate more anime with AniList data to see this comparison.</p>
        ) : (
          <>
            <div className="flex gap-6 mb-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{avgUserNorm}</p>
                <p className="text-xs text-slate-400 mt-1">You</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{avgCommunity}</p>
                <p className="text-xs text-slate-400 mt-1">Community</p>
              </div>
            </div>
            {scoreDelta != null && (
              <p className="text-xs text-slate-400">
                {scoreDelta === 0
                  ? "Right in line with the community average"
                  : scoreDelta > 0
                  ? `You rate +${scoreDelta} pts above community average`
                  : `You rate ${scoreDelta} pts below community average`}
                {" "}· out of 100
              </p>
            )}
          </>
        )}
      </div>

      {/* Score by release year */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Score by Release Year</h3>
        <p className="text-xs text-slate-500 mb-4">Based on anime start year · {scatterData.length} rated</p>
        <ScoreByYearScatter data={scatterData} />
      </div>

      {/* Format */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Format</h3>
        <div className="flex gap-4">
          {Object.entries(formatCounts).map(([format, count]) => (
            <Link
              key={format}
              href={`/library?format=${format}`}
              className="text-center hover:opacity-75 transition-opacity"
            >
              <p className="text-2xl font-bold text-white">{count}</p>
              <p className="text-xs text-slate-400 capitalize">{format.toLowerCase()}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stars({ score }: { score: number }) {
  return (
    <div className="flex justify-center gap-0.5 mt-1">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = score >= i;
        const half = !filled && score >= i - 0.5;
        return (
          <svg key={i} viewBox="0 0 24 24" className="w-3.5 h-3.5">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill="#475569"
            />
            {filled && (
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill="#facc15"
              />
            )}
            {half && (
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill="#facc15"
                style={{ clipPath: "inset(0 50% 0 0)" }}
              />
            )}
          </svg>
        );
      })}
    </div>
  );
}

function formatWatchTime(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  const days = hours / 24;
  if (days >= 365) return `${(days / 365).toFixed(1)} yrs`;
  if (days >= 30)  return `${(days / 30).toFixed(1)} mo`;
  if (days >= 1)   return `${Math.round(days)} days`;
  return `${Math.round(hours)} hrs`;
}

function StatCard({ label, value, href, subtitle, title }: { label: string; value: string; href: string; subtitle?: React.ReactNode; title?: string }) {
  return (
    <Link
      href={href}
      title={title}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center hover:border-slate-600 hover:bg-slate-800/50 transition-colors block"
    >
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtitle}
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </Link>
  );
}
