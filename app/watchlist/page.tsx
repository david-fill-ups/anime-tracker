export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import CatchUpAutoRefresh from "@/components/CatchUpAutoRefresh";

const STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

function isStale(date: Date | null | undefined): boolean {
  if (!date) return true;
  return Date.now() - new Date(date).getTime() > STALE_MS;
}

function formatCountdown(date: Date | null | undefined): string {
  if (!date) return "Unknown";
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return "Aired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `in ${days}d ${hours}h`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

export default async function WatchListPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const entries = await db.userEntry.findMany({
    where: {
      userId,
      watchStatus: "WATCHING",
      anime: { airingStatus: "RELEASING", mergedIntoId: null },
    },
    include: { anime: true },
  });

  const staleIds = entries
    .filter((e) => e.anime.source === "ANILIST" && isStale(e.anime.lastSyncedAt))
    .map((e) => e.anime.id);

  const items = entries.map((e) => {
    const anime = e.anime;
    const nextEp = anime.nextAiringEp;
    const nextAt = anime.nextAiringAt;

    let episodesAired: number | null = null;
    if (nextEp != null) {
      const isPast = nextAt ? new Date(nextAt).getTime() < Date.now() : false;
      episodesAired = isPast ? nextEp : nextEp - 1;
    } else if (anime.totalEpisodes != null) {
      episodesAired = anime.totalEpisodes;
    }

    const behind =
      episodesAired != null ? Math.max(0, episodesAired - e.currentEpisode) : null;

    return { anime, entry: e, episodesAired, behind, nextAt };
  });

  // Catch Up: behind on episodes, sorted most behind first
  const catchUpItems = items
    .filter((i) => i.behind == null || i.behind > 0)
    .sort((a, b) => {
      if (a.behind == null && b.behind == null) return 0;
      if (a.behind == null) return 1;
      if (b.behind == null) return -1;
      return b.behind - a.behind;
    });

  // Keep Up: fully caught up, sorted by soonest next episode
  const keepUpItems = items
    .filter((i) => i.behind === 0)
    .sort((a, b) => {
      if (!a.nextAt && !b.nextAt) return 0;
      if (!a.nextAt) return 1;
      if (!b.nextAt) return -1;
      return new Date(a.nextAt).getTime() - new Date(b.nextAt).getTime();
    });

  return (
    <div className="space-y-10 max-w-2xl">
      <CatchUpAutoRefresh staleIds={staleIds} />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Watch List</h2>
        {staleIds.length > 0 && (
          <span className="text-xs text-slate-500">
            Syncing {staleIds.length} show{staleIds.length !== 1 ? "s" : ""}…
          </span>
        )}
      </div>

      {/* Catch Up section */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Catch Up</h3>
        {catchUpItems.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">You&apos;re all caught up!</p>
        ) : (
          <div className="space-y-3">
            {catchUpItems.map(({ anime, entry, episodesAired, behind, nextAt }) => {
              const title = anime.titleEnglish || anime.titleRomaji;
              return (
                <Link
                  key={anime.id}
                  href={`/anime/${anime.id}`}
                  className="flex gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors"
                >
                  {anime.coverImageUrl && (
                    <Image
                      src={anime.coverImageUrl}
                      alt={title}
                      width={48}
                      height={64}
                      className="rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {episodesAired != null
                        ? `Ep ${entry.currentEpisode} / ${episodesAired} aired`
                        : `Ep ${entry.currentEpisode}`}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Next ep: {formatCountdown(nextAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end justify-center flex-shrink-0">
                    {behind != null && behind > 0 && (
                      <span className="text-xs font-medium text-amber-400 bg-amber-900/30 border border-amber-800/50 px-2 py-0.5 rounded-full">
                        {behind} behind
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Keep Up section */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Keep Up</h3>
        {keepUpItems.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">
            No caught-up currently airing shows.
          </p>
        ) : (
          <div className="space-y-3">
            {keepUpItems.map(({ anime, entry, episodesAired, nextAt }) => {
              const title = anime.titleEnglish || anime.titleRomaji;
              return (
                <Link
                  key={anime.id}
                  href={`/anime/${anime.id}`}
                  className="flex gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors"
                >
                  {anime.coverImageUrl && (
                    <Image
                      src={anime.coverImageUrl}
                      alt={title}
                      width={48}
                      height={64}
                      className="rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {episodesAired != null
                        ? `Ep ${entry.currentEpisode} / ${episodesAired} aired`
                        : `Ep ${entry.currentEpisode}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end justify-center flex-shrink-0 gap-1">
                    <span className="text-xs font-medium text-green-400 bg-green-900/30 border border-green-800/50 px-2 py-0.5 rounded-full">
                      Caught up
                    </span>
                    <p className="text-xs text-slate-500 text-right">{formatCountdown(nextAt)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
