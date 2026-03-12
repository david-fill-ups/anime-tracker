export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import PersonActions from "@/components/PersonActions";

const ENGAGED_STATUSES = ["WATCHING", "COMPLETED", "DROPPED"] as const;

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

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;
  const personId = Number(id);
  if (isNaN(personId)) notFound();

  const person = await db.person.findUnique({ where: { id: personId, userId } });
  if (!person) notFound();

  const links = await db.link.findMany({
    where: { userId, userEntry: { is: { recommenderId: personId } } },
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
  });

  const entries = links
    .filter((l) => l.userEntry && l.linkedAnime[0]?.anime)
    .map((l) => ({ ...l.userEntry!, anime: l.linkedAnime[0].anime }));

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  for (const e of entries) {
    statusCounts[e.watchStatus] = (statusCounts[e.watchStatus] ?? 0) + 1;
  }

  // Hours watched
  const activeEntries = entries.filter(
    (e) => e.watchStatus === "COMPLETED" || e.watchStatus === "WATCHING"
  );
  const totalHours = Math.round(
    activeEntries.reduce((sum, e) => {
      const mins = e.anime.durationMins ?? 24;
      return sum + mins * e.currentEpisode;
    }, 0) / 60
  );

  // Avg score — engaged only
  const engagedSet = new Set<string>(ENGAGED_STATUSES);
  const rated = entries.filter((e) => e.score != null && engagedSet.has(e.watchStatus));
  const avgScore = rated.length
    ? Math.round((rated.reduce((s, e) => s + (e.score ?? 0), 0) / rated.length) * 10) / 10
    : null;

  // Top genres
  const genreCounts: Record<string, number> = {};
  for (const e of entries.filter((e) => engagedSet.has(e.watchStatus))) {
    const genres: string[] = JSON.parse(e.anime.genres || "[]");
    for (const g of genres) genreCounts[g] = (genreCounts[g] ?? 0) + 1;
  }
  const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Studio scores
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

  // Format breakdown
  const formatCounts: Record<string, number> = {};
  for (const e of entries.filter((e) => engagedSet.has(e.watchStatus))) {
    formatCounts[e.anime.displayFormat] = (formatCounts[e.anime.displayFormat] ?? 0) + 1;
  }

  const completedCount = statusCounts["COMPLETED"] ?? 0;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <Link href="/people" className="text-sm text-slate-500 hover:text-slate-300 transition-colors mb-3 inline-block">
          ← People
        </Link>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-white">{person.name}</h2>
          <PersonActions id={person.id} name={person.name} />
        </div>
      </div>

      {/* Top-line numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Recommended" value={String(entries.length)} href={`/backlog?recommender=${person.id}`} />
        <StatCard label="Completed" value={String(completedCount)} href={`/library?recommender=${person.id}&status=COMPLETED`} />
        <StatCard label="Hours Watched" value={String(totalHours)} href={`/library?recommender=${person.id}`} />
        <StatCard label="Avg Score" value={avgScore != null ? `${avgScore} / 5` : "—"} href={`/library?recommender=${person.id}&sort=score`} />
      </div>

      {/* Status breakdown */}
      {entries.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(statusCounts).map(([status, count]) => {
              const pct = Math.round((count / entries.length) * 100);
              return (
                <Link
                  key={status}
                  href={`/library?recommender=${person.id}&status=${status}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 hover:bg-slate-800/60 transition-colors"
                >
                  <span className="text-sm text-slate-400 w-32">{STATUS_LABELS[status] ?? status}</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-2">
                    <div className={`h-2 rounded-full ${STATUS_COLORS[status] ?? "bg-slate-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm text-slate-400 w-12 text-right">{count}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Top genres */}
      {topGenres.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Top Genres</h3>
          <div className="grid grid-cols-2 gap-2">
            {topGenres.map(([genre, count]) => (
              <Link
                key={genre}
                href={`/library?recommender=${person.id}&genre=${encodeURIComponent(genre)}`}
                className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2 hover:bg-slate-700 transition-colors"
              >
                <span className="text-sm text-slate-300">{genre}</span>
                <span className="text-sm font-medium text-white">{count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Studio ratings */}
      {topStudios.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Studio Ratings</h3>
          <p className="text-xs text-slate-500 mb-4">Hours-weighted avg · ≥2 rated entries</p>
          <div className="space-y-2">
            {topStudios.map((s) => (
              <Link
                key={s.name}
                href={`/library?recommender=${person.id}&studio=${encodeURIComponent(s.name)}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 hover:bg-slate-800/60 transition-colors"
              >
                <span className="text-sm text-slate-300 flex-1">{s.name}</span>
                <span className="text-xs text-slate-500">{s.count} anime</span>
                <span className="text-sm font-medium text-yellow-400">★ {s.avg}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Format */}
      {Object.keys(formatCounts).length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Format</h3>
          <div className="flex gap-4">
            {Object.entries(formatCounts).map(([format, count]) => (
              <Link
                key={format}
                href={`/library?recommender=${person.id}&format=${format}`}
                className="text-center hover:opacity-75 transition-opacity"
              >
                <p className="text-2xl font-bold text-white">{count}</p>
                <p className="text-xs text-slate-400 capitalize">{format.toLowerCase()}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-slate-500 text-sm">No recommendations from {person.name} yet.</p>
      )}
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
