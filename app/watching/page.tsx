export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import CatchUpAutoRefresh from "@/components/CatchUpAutoRefresh";

function isStale(date: Date | null | undefined): boolean {
  if (!date) return true;
  const todayMidnightUTC = new Date();
  todayMidnightUTC.setUTCHours(0, 0, 0, 0);
  return new Date(date) < todayMidnightUTC;
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

  const links = await db.link.findMany({
    where: {
      userId,
      OR: [
        { userEntry: { is: { watchStatus: "WATCHING" } } },
        {
          userEntry: { is: { watchStatus: "COMPLETED" } },
          linkedAnime: { some: { anime: { airingStatus: "RELEASING" } } },
        },
      ],
    },
    include: {
      userEntry: true,
      linkedAnime: {
        include: {
          anime: {
            select: {
              id: true,
              source: true,
              lastSyncedAt: true,
              totalEpisodes: true,
              nextAiringEp: true,
              nextAiringAt: true,
              lastKnownAiredEp: true,
              airingStatus: true,
              titleEnglish: true,
              titleRomaji: true,
              coverImageUrl: true,
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  const staleMap = new Map<number, Date | null>();
  for (const link of links) {
    for (const la of link.linkedAnime) {
      if (la.anime.source === "ANILIST" && isStale(la.anime.lastSyncedAt) && !staleMap.has(la.anime.id)) {
        staleMap.set(la.anime.id, la.anime.lastSyncedAt ? new Date(la.anime.lastSyncedAt) : null);
      }
    }
  }
  // Sort: never-synced (null) first, then oldest lastSyncedAt first
  const staleIds = [...staleMap.entries()]
    .sort(([, a], [, b]) => {
      if (!a && !b) return 0;
      if (!a) return -1;
      if (!b) return 1;
      return a.getTime() - b.getTime();
    })
    .map(([id]) => id);

  const items = links.map((link) => {
    const entry = link.userEntry!;
    const primaryAnime = link.linkedAnime[0]?.anime;
    const allShows = link.linkedAnime.map((la) => la.anime);

    // Calculate total episodes aired across all linked anime (in order)
    let episodesAired: number | null = null;
    let nextAt: Date | null = null;

    for (const show of allShows) {
      if (show.airingStatus === "FINISHED" || show.airingStatus === "CANCELLED") {
        if (show.totalEpisodes != null) episodesAired = (episodesAired ?? 0) + show.totalEpisodes;
      } else if (show.airingStatus === "RELEASING") {
        if (show.nextAiringEp != null) {
          const showNextAt = show.nextAiringAt ? new Date(show.nextAiringAt) : null;
          const isPast = showNextAt ? showNextAt.getTime() < Date.now() : false;
          episodesAired = (episodesAired ?? 0) + (isPast ? show.nextAiringEp : show.nextAiringEp - 1);
          if (!nextAt && showNextAt && !isPast) nextAt = showNextAt;
        } else if (show.lastKnownAiredEp != null) {
          // nextAiringEp is null but we have a prior known aired count (e.g. between
          // episodes where AniList hasn't scheduled the next one yet). Use it as a
          // floor so the user doesn't incorrectly appear in Catch Up when caught up.
          episodesAired = (episodesAired ?? 0) + show.lastKnownAiredEp;
        } else {
          // nextAiringEp is null and no prior data: can't determine aired count.
          // Mark as unknown so the entry appears in Catch Up rather than Keep Up.
          episodesAired = null;
          break;
        }
      }
      // NOT_YET_RELEASED: 0 episodes aired, skip
    }

    const behind = episodesAired != null ? Math.max(0, episodesAired - entry.currentEpisode) : null;
    const isReleasing = allShows.some((s) => s.airingStatus === "RELEASING");

    return { anime: primaryAnime, entry, episodesAired, behind, nextAt, isReleasing };
  });

  // Catch Up: behind on episodes, sorted most behind first
  // behind=null only counts if isReleasing — that means we can't determine aired count (e.g. mid-cour break).
  // If behind=null and NOT isReleasing, all shows are NOT_YET_RELEASED — nothing has aired, so not behind.
  const catchUpItems = items
    .filter((i) => (i.behind == null && i.isReleasing) || (i.behind != null && i.behind > 0))
    .sort((a, b) => {
      if (a.behind == null && b.behind == null) return 0;
      if (a.behind == null) return 1;
      if (b.behind == null) return -1;
      return b.behind - a.behind;
    });

  // Keep Up: fully caught up on a currently-releasing show, sorted by soonest next episode
  const keepUpItems = items
    .filter((i) => i.behind === 0 && i.isReleasing)
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
        <h2 className="text-2xl font-bold text-white">Watching</h2>
        {staleIds.length > 0 && (
          <span className="text-xs text-slate-500">
            Syncing {staleIds.length} show{staleIds.length !== 1 ? "s" : ""}…
          </span>
        )}
      </div>

      {/* Catch Up section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Catch Up</h3>
          {catchUpItems.reduce((sum, i) => sum + (i.behind ?? 0), 0) > 0 && (
            <span className="text-xs font-medium text-amber-400 bg-amber-900/30 border border-amber-800/50 px-2 py-0.5 rounded-full">
              {catchUpItems.reduce((sum, i) => sum + (i.behind ?? 0), 0)} episodes behind
            </span>
          )}
        </div>
        {catchUpItems.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">You&apos;re all caught up!</p>
        ) : (
          <div className="space-y-3">
            {catchUpItems.map(({ anime, entry, episodesAired, behind, nextAt }) => {
              if (!anime) return null;
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
                      {episodesAired != null && episodesAired >= entry.currentEpisode
                        ? `Ep ${entry.currentEpisode} / ${episodesAired} aired`
                        : `Ep ${entry.currentEpisode}`}
                    </p>
                    {nextAt && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        Next ep {formatCountdown(nextAt)}
                      </p>
                    )}
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
              if (!anime) return null;
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
                      {episodesAired != null && episodesAired >= entry.currentEpisode
                        ? `Ep ${entry.currentEpisode} / ${episodesAired} aired`
                        : `Ep ${entry.currentEpisode}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end justify-center flex-shrink-0 gap-1">
                    <span className="text-xs font-medium text-green-400 bg-green-900/30 border border-green-800/50 px-2 py-0.5 rounded-full">
                      Caught up
                    </span>
                    {nextAt && <p className="text-xs text-slate-500 text-right">Next ep {formatCountdown(nextAt)}</p>}
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
