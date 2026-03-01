export const dynamic = "force-dynamic";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [entries, animes] = await Promise.all([
    db.userEntry.findMany({
      where: { userId },
      include: {
        anime: {
          include: { animeStudios: { include: { studio: true }, where: { isMainStudio: true } } },
        },
      },
    }),
    db.anime.findMany({ where: { userEntries: { some: { userId } }, mergedIntoId: null } }),
  ]);

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  for (const e of entries) {
    statusCounts[e.watchStatus] = (statusCounts[e.watchStatus] ?? 0) + 1;
  }

  // Total hours watched (completed + watching)
  const activeEntries = entries.filter(
    (e) => e.watchStatus === "COMPLETED" || e.watchStatus === "WATCHING"
  );
  const totalMinutes = activeEntries.reduce((sum, e) => {
    const mins = e.anime.durationMins ?? 24;
    return sum + mins * e.currentEpisode;
  }, 0);
  const totalHours = Math.round(totalMinutes / 60);

  // Score distribution
  const rated = entries.filter((e) => e.score != null);
  const avgScore = rated.length
    ? Math.round((rated.reduce((s, e) => s + (e.score ?? 0), 0) / rated.length) * 10) / 10
    : null;

  // Genre breakdown
  const genreCounts: Record<string, number> = {};
  for (const anime of animes) {
    const genres: string[] = JSON.parse(anime.genres || "[]");
    for (const g of genres) {
      genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    }
  }
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Studio breakdown (avg score per main studio)
  const studioScores: Record<string, { sum: number; count: number }> = {};
  for (const e of rated) {
    const studio = e.anime.animeStudios[0]?.studio.name;
    if (studio) {
      if (!studioScores[studio]) studioScores[studio] = { sum: 0, count: 0 };
      studioScores[studio].sum += e.score ?? 0;
      studioScores[studio].count += 1;
    }
  }
  const topStudios = Object.entries(studioScores)
    .filter(([, v]) => v.count >= 2)
    .map(([name, v]) => ({ name, avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  // Format breakdown
  const formatCounts: Record<string, number> = {};
  for (const a of animes) formatCounts[a.displayFormat] = (formatCounts[a.displayFormat] ?? 0) + 1;

  const STATUS_LABELS: Record<string, string> = {
    WATCHING: "Watching",
    COMPLETED: "Completed",
    ON_HOLD: "On Hold",
    DROPPED: "Dropped",
    PLAN_TO_WATCH: "Plan to Watch",
    RECOMMENDED: "Recommended",
  };

  const STATUS_COLORS: Record<string, string> = {
    WATCHING: "bg-blue-500",
    COMPLETED: "bg-green-500",
    ON_HOLD: "bg-yellow-500",
    DROPPED: "bg-red-500",
    PLAN_TO_WATCH: "bg-purple-500",
    RECOMMENDED: "bg-orange-500",
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Stats</h2>
        <a
          href="/api/export"
          className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md transition-colors"
        >
          Export CSV
        </a>
      </div>

      {/* Top-line numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Tracked" value={String(entries.length)} href="/library" />
        <StatCard label="Completed" value={String(statusCounts["COMPLETED"] ?? 0)} href="/library?status=COMPLETED" />
        <StatCard label="Hours Watched" value={String(totalHours)} href="/library?status=COMPLETED" />
        <StatCard label="Avg Score" value={avgScore != null ? `${avgScore}/10` : "—"} href="/library?sort=score" />
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
        <p className="text-xs text-slate-500 mb-4">Studios with ≥2 rated entries</p>
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

function StatCard({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center hover:border-slate-600 hover:bg-slate-800/50 transition-colors block"
    >
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </Link>
  );
}
