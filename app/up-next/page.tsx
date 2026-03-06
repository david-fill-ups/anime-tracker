export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AnimeGrid from "@/components/AnimeGrid";
import RecommendationsSection from "@/components/RecommendationsSection";
import type { RecommendationItem } from "@/components/RecommendationsSection";
import type { WatchStatus, AiringStatus } from "@/app/generated/prisma";
import { effectiveTotalEpisodes, effectiveAiringStatus, MERGED_ANIME_SELECT } from "@/lib/anime-utils";
import Link from "next/link";

// Statuses that mean "actively in your library" (used to find watched franchises)
const LIBRARY_STATUSES: WatchStatus[] = ["WATCHING", "COMPLETED", "ON_HOLD", "DROPPED"];

// Statuses that belong to the queue (user has explicitly added these)
const QUEUE_STATUSES: WatchStatus[] = ["PLAN_TO_WATCH", "RECOMMENDED"];

export default async function QueuePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // Plan to Watch: explicitly queued by the user
  const rawPlanToWatch = await db.anime.findMany({
    where: { userEntries: { some: { userId, watchStatus: { in: QUEUE_STATUSES } } }, mergedIntoId: null },
    include: {
      userEntries: { where: { userId }, include: { recommender: true, watchContextPerson: true }, take: 1 },
      franchiseEntries: { include: { franchise: true } },
      animeStudios: { include: { studio: true } },
      mergedAnimes: { select: MERGED_ANIME_SELECT },
    },
  });

  // Sort client-side by entry updatedAt (Prisma 7.4 doesn't support _max on relations)
  const planToWatch = rawPlanToWatch
    .map((a) => ({
      ...a,
      userEntry: a.userEntries[0] ?? null,
      totalEpisodes: effectiveTotalEpisodes(a),
      airingStatus: effectiveAiringStatus(a) as AiringStatus,
    }))
    .sort((a, b) => (b.userEntry?.updatedAt?.getTime() ?? 0) - (a.userEntry?.updatedAt?.getTime() ?? 0));

  // Recommendations: find franchises where you've watched at least one entry,
  // then surface siblings you haven't added to your library or queue yet.
  const watchedFranchises = await db.franchise.findMany({
    where: {
      userId,
      entries: {
        some: {
          anime: { userEntries: { some: { userId, watchStatus: { in: LIBRARY_STATUSES } } } },
        },
      },
    },
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: {
          anime: {
            include: {
              userEntries: { where: { userId }, take: 1 },
              franchiseEntries: { include: { franchise: true } },
              animeStudios: { include: { studio: true } },
              mergedAnimes: { select: MERGED_ANIME_SELECT },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Collect recommendations — deduplicate by anime id
  const seenIds = new Set<number>();
  const recommendations: RecommendationItem[] = [];

  for (const franchise of watchedFranchises) {
    for (const entry of franchise.entries) {
      const rawAnime = entry.anime;
      // Skip merged secondaries — they're represented by their primary
      if (rawAnime.mergedIntoId !== null) { seenIds.add(rawAnime.id); continue; }
      if (seenIds.has(rawAnime.id)) continue;

      const anime = {
        ...rawAnime,
        userEntry: rawAnime.userEntries[0] ?? null,
        totalEpisodes: effectiveTotalEpisodes(rawAnime),
        airingStatus: effectiveAiringStatus(rawAnime) as AiringStatus,
      };
      const status = anime.userEntry?.watchStatus;

      // Skip if already in library or queue
      if (
        status &&
        (LIBRARY_STATUSES.includes(status) || QUEUE_STATUSES.includes(status))
      ) {
        seenIds.add(anime.id);
        continue;
      }

      seenIds.add(anime.id);
      const isNotInterested = status === "NOT_INTERESTED";
      if (!isNotInterested && recommendations.filter((r) => !r.isNotInterested).length >= 6) continue;
      recommendations.push({
        anime,
        franchise: { id: franchise.id, name: franchise.name },
        franchiseOrder: entry.order,
        isNotInterested,
      });
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Up Next</h2>
        <Link
          href="/library/add"
          className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md transition-colors"
        >
          + Add Anime
        </Link>
      </div>

      {/* Recommendations — franchise siblings you haven't seen */}
      <Suspense>
        <RecommendationsSection items={recommendations} />
      </Suspense>

      {/* Plan to Watch — manually queued entries */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-white">
          Plan to Watch
          {planToWatch.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-500">{planToWatch.length}</span>
          )}
        </h3>

        {planToWatch.length === 0 ? (
          <p className="text-slate-500 text-sm py-8 text-center">
            Nothing here yet — mark a recommendation as Interested or{" "}
            <Link href="/library/add" className="text-indigo-400 hover:text-indigo-300">
              add an anime
            </Link>{" "}
            with Plan to Watch status.
          </p>
        ) : (
          <AnimeGrid animes={planToWatch} />
        )}
      </section>
    </div>
  );
}
