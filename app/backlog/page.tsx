export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AnimeGrid from "@/components/AnimeGrid";
import RecommendationsSection from "@/components/RecommendationsSection";
import UpNextFilters from "@/components/UpNextFilters";
import type { RecommendationItem } from "@/components/RecommendationsSection";
import type { WatchStatus, AiringStatus, StreamingService } from "@/app/generated/prisma";
import { effectiveTotalEpisodesFromLink, effectiveAiringStatusFromLink } from "@/lib/anime-utils";
import Link from "next/link";

// Statuses that mean "actively in your library" (used to find watched franchises)
const LIBRARY_STATUSES: WatchStatus[] = ["WATCHING", "COMPLETED", "DROPPED"];

// Statuses that belong to the queue (user has explicitly added these)
const QUEUE_STATUSES: WatchStatus[] = ["PLAN_TO_WATCH"];

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; airingStatus?: string; recommender?: string; quickBinge?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { service, airingStatus, recommender, quickBinge } = await searchParams;

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
              streamingLinks: true,
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const allPlanToWatch = rawLinks
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
              streamingLinks: true,
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Collect recommendations — deduplicate by anime id
  const seenIds = new Set<number>();
  const allRecommendations: RecommendationItem[] = [];

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

      // Detect "new season": user has no entry for this anime AND all earlier
      // franchise entries are marked COMPLETED — meaning they may not know this exists.
      const isNewSeason =
        !userEntry &&
        franchise.entries.some((e) => e.order < entry.order) &&
        franchise.entries
          .filter((e) => e.order < entry.order)
          .every((e) => e.anime.linkedIn[0]?.link.userEntry?.watchStatus === "COMPLETED");

      // Find the link to suggest attaching this anime to.
      // Only suggest if all preceding franchise entries that have a user link are in the SAME link.
      const precedingLinkedAnimes = franchise.entries
        .filter((e) => e.order < entry.order && e.anime.linkedIn.length > 0)
        .map((e) => e.anime.linkedIn[0]!);
      const uniqueLinkIds = new Set(precedingLinkedAnimes.map((la) => la.linkId));
      const suggestedLinkId = uniqueLinkIds.size === 1 ? precedingLinkedAnimes[0].linkId : null;
      const suggestedLinkName = suggestedLinkId
        ? (precedingLinkedAnimes[0].link.name ?? franchise.name)
        : null;

      seenIds.add(anime.id);
      const isNotInterested = status === "NOT_INTERESTED";
      allRecommendations.push({
        anime,
        franchise: { id: franchise.id, name: franchise.name },
        franchiseOrder: entry.order,
        isNotInterested,
        isNewSeason,
        suggestedLinkId,
        suggestedLinkName,
      });
    }
  }

  // Sort: new-season items first, then regular, not-interested last
  allRecommendations.sort((a, b) => {
    if (a.isNotInterested !== b.isNotInterested) return a.isNotInterested ? 1 : -1;
    if (a.isNewSeason !== b.isNewSeason) return a.isNewSeason ? -1 : 1;
    return 0;
  });

  // Cap active (non-not-interested) recommendations at 6
  let activeCount = 0;
  const cappedRecommendations = allRecommendations.filter((r) => {
    if (r.isNotInterested) return true;
    if (activeCount < 6) { activeCount++; return true; }
    return false;
  });

  // Derive available filter options from unfiltered data
  const serviceSet = new Set<StreamingService>();
  for (const a of allPlanToWatch) {
    for (const l of a.streamingLinks) serviceSet.add(l.service);
  }
  for (const r of allRecommendations) {
    for (const l of (r.anime as typeof allPlanToWatch[number]).streamingLinks ?? []) serviceSet.add(l.service);
  }
  const availableServices = Array.from(serviceSet);

  const recommenderMap = new Map<number, string>();
  for (const a of allPlanToWatch) {
    if (a.userEntry?.recommender) {
      recommenderMap.set(a.userEntry.recommender.id, a.userEntry.recommender.name);
    }
  }
  const availableRecommenders = Array.from(recommenderMap.entries()).map(([id, name]) => ({ id, name }));

  // Apply filters
  const isQuickBinge = quickBinge === "1";

  const planToWatch = allPlanToWatch.filter((a) => {
    if (service && !a.streamingLinks.some((l) => l.service === service)) return false;
    if (airingStatus && a.airingStatus !== airingStatus) return false;
    if (recommender && String(a.userEntry?.recommenderId ?? "") !== recommender) return false;
    if (isQuickBinge && (a.airingStatus !== "FINISHED" || (a.totalEpisodes ?? Infinity) > 15)) return false;
    return true;
  });

  const recommendations = cappedRecommendations.filter((r) => {
    const anime = r.anime as typeof allPlanToWatch[number];
    if (service && !anime.streamingLinks?.some((l) => l.service === service)) return false;
    if (airingStatus && anime.airingStatus !== airingStatus) return false;
    if (isQuickBinge && (anime.airingStatus !== "FINISHED" || (anime.totalEpisodes ?? Infinity) > 15)) return false;
    return true;
  });

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Backlog</h2>
        <Link
          href="/library/add?returnTo=/backlog"
          className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md transition-colors"
        >
          + Add Anime
        </Link>
      </div>

      <Suspense>
        <UpNextFilters services={availableServices} recommenders={availableRecommenders} />
      </Suspense>

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
            <Link href="/library/add?returnTo=/backlog" className="text-indigo-400 hover:text-indigo-300">
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
