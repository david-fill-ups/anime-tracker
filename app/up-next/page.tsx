export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AnimeGrid from "@/components/AnimeGrid";
import RecommendationsSection from "@/components/RecommendationsSection";
import type { RecommendationItem } from "@/components/RecommendationsSection";
import type { WatchStatus, AiringStatus } from "@/app/generated/prisma";
import { effectiveTotalEpisodesFromLink, effectiveAiringStatusFromLink } from "@/lib/anime-utils";
import Link from "next/link";

// Statuses that mean "actively in your library" (used to find watched franchises)
const LIBRARY_STATUSES: WatchStatus[] = ["WATCHING", "COMPLETED", "DROPPED"];

// Statuses that belong to the queue (user has explicitly added these)
const QUEUE_STATUSES: WatchStatus[] = ["PLAN_TO_WATCH", "RECOMMENDED"];

export default async function QueuePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // Plan to Watch: explicitly queued by the user
  const rawLinks = await db.link.findMany({
    where: { userId, userEntry: { is: { watchStatus: { in: QUEUE_STATUSES } } } },
    include: {
      userEntry: { include: { recommender: true, watchContextPerson: true } },
      linkedAnime: {
        include: {
          anime: {
            include: {
              franchiseEntries: { include: { franchise: true } },
              animeStudios: { include: { studio: true } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const planToWatch = rawLinks
    .filter((l) => l.userEntry && l.linkedAnime.length > 0)
    .map((l) => ({
      ...l.linkedAnime[0].anime,
      userEntry: l.userEntry,
      totalEpisodes: effectiveTotalEpisodesFromLink(l.linkedAnime),
      airingStatus: effectiveAiringStatusFromLink(l.linkedAnime) as AiringStatus,
    }));

  // Recommendations: find franchises where you've watched at least one entry,
  // then surface siblings you haven't added to your library or queue yet.
  const watchedFranchises = await db.franchise.findMany({
    where: {
      userId,
      entries: {
        some: {
          anime: { linkedIn: { some: { link: { userId, userEntry: { is: { watchStatus: { in: LIBRARY_STATUSES } } } } } } },
        },
      },
    },
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: {
          anime: {
            include: {
              linkedIn: {
                where: { link: { userId } },
                include: { link: { include: { userEntry: true } } },
                take: 1,
              },
              franchiseEntries: { include: { franchise: true } },
              animeStudios: { include: { studio: true } },
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
      // Skip anime that are non-primary (order > 0) in this user's link
      const userLinkedAnime = rawAnime.linkedIn[0];
      if (userLinkedAnime && userLinkedAnime.order > 0) { seenIds.add(rawAnime.id); continue; }
      if (seenIds.has(rawAnime.id)) continue;

      const userEntry = userLinkedAnime?.link.userEntry ?? null;
      const anime = {
        ...rawAnime,
        userEntry,
        totalEpisodes: rawAnime.totalEpisodes,
        airingStatus: rawAnime.airingStatus as AiringStatus,
      };
      const status = userEntry?.watchStatus;

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
