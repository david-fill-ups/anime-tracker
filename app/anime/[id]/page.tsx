export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return "never";
  const diffMs = Date.now() - new Date(date).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
import { notFound } from "next/navigation";
import Image from "next/image";
import StatusBadge from "@/components/StatusBadge";
import AnimeEditForm from "@/components/AnimeEditForm";
import WhereToWatch from "@/components/WhereToWatch";
import StreamingAutoRefresh from "@/components/StreamingAutoRefresh";
import AnimeMetaEdit from "@/components/AnimeMetaEdit";
import LinkManager from "@/components/LinkManager";
import LinkDetailClient from "@/components/LinkDetailClient";
import { effectiveTotalEpisodesFromLink, effectiveAiringStatusFromLink, LINKED_ANIME_SELECT } from "@/lib/anime-utils";
import type { AiringStatus } from "@/app/generated/prisma";
import { Suspense } from "react";
import RelatedAnime from "@/components/RelatedAnime";

export default async function AnimeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;
  const rawAnime = await db.anime.findUnique({
    where: { id: Number(id) },
    include: {
      franchiseEntries: { include: { franchise: true }, orderBy: { order: "asc" } },
      animeStudios: { include: { studio: true } },
      streamingLinks: { orderBy: { service: "asc" } },
    },
  });

  if (!rawAnime) notFound();

  // Find this anime's Link for this user
  const link = await db.link.findFirst({
    where: { userId, linkedAnime: { some: { animeId: rawAnime.id } } },
    include: {
      linkedAnime: {
        include: { anime: { select: LINKED_ANIME_SELECT } },
        orderBy: { order: "asc" },
      },
      userEntry: { include: { recommender: true, watchContextPerson: true } },
    },
  });

  const entry = link?.userEntry ?? null;
  const isMultiLink = (link?.linkedAnime.length ?? 0) > 1;

  const genres: string[] = JSON.parse(rawAnime.genres || "[]");
  const mainStudios = rawAnime.animeStudios.filter((s) => s.isMainStudio);

  // Effective totals across all linked anime
  const totalEpisodes = link
    ? effectiveTotalEpisodesFromLink(link.linkedAnime)
    : rawAnime.totalEpisodes;
  const airingStatus = link
    ? (effectiveAiringStatusFromLink(link.linkedAnime) as AiringStatus)
    : rawAnime.airingStatus;

  const title = rawAnime.titleEnglish || rawAnime.titleRomaji;

  const [people, franchises] = await Promise.all([
    db.person.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.franchise.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);

  // Linked anime seasons for AnimeEditForm (single-link case)
  const linkedAnimeSeasonsForForm = (link?.linkedAnime ?? []).map((la) => ({
    order: la.order,
    anime: {
      id: la.anime.id,
      titleRomaji: la.anime.titleRomaji,
      titleEnglish: la.anime.titleEnglish,
      totalEpisodes: la.anime.totalEpisodes,
      totalSeasons: la.anime.totalSeasons,
      episodesPerSeason: la.anime.episodesPerSeason,
    },
  }));

  // ── Multi-link: delegate to client component for overview/detail toggle ──────
  if (isMultiLink && link) {
    const linkData = {
      id: link.id,
      name: link.name,
      linkedAnime: link.linkedAnime.map((la) => ({
        id: la.id,
        order: la.order,
        anime: {
          id: la.anime.id,
          titleRomaji: la.anime.titleRomaji,
          titleEnglish: la.anime.titleEnglish,
          coverImageUrl: la.anime.coverImageUrl,
          synopsis: la.anime.synopsis,
          totalEpisodes: la.anime.totalEpisodes,
          totalSeasons: la.anime.totalSeasons,
          episodesPerSeason: la.anime.episodesPerSeason,
          meanScore: la.anime.meanScore,
          airingStatus: la.anime.airingStatus,
          season: la.anime.season,
          seasonYear: la.anime.seasonYear,
          displayFormat: la.anime.displayFormat,
          anilistId: la.anime.anilistId,
          // Only the page's own anime has tmdb/external/genre data loaded
          tmdbId: la.anime.id === rawAnime.id ? rawAnime.tmdbId : null,
          tmdbMediaType: la.anime.id === rawAnime.id ? rawAnime.tmdbMediaType : null,
          externalUrl: la.anime.id === rawAnime.id ? rawAnime.externalUrl : null,
          genres: la.anime.id === rawAnime.id ? rawAnime.genres : "[]",
        },
      })),
      userEntry: link.userEntry,
    };

    return (
      <div className="max-w-3xl space-y-8">
        <LinkDetailClient
          link={linkData}
          primaryAnime={rawAnime}
          people={people}
          franchises={franchises}
          streamingLinks={rawAnime.streamingLinks}
          streamingCheckedAt={rawAnime.streamingCheckedAt}
          source={rawAnime.source}
          lastSyncedAt={rawAnime.lastSyncedAt}
        />

        {rawAnime.anilistId && (
          <Suspense fallback={null}>
            <RelatedAnime
              anilistId={rawAnime.anilistId}
              userId={userId}
              franchiseIds={rawAnime.franchiseEntries.map((fe) => fe.franchise.id)}
              linkId={link.id}
              linkedAnilistIds={link.linkedAnime.map((la) => la.anime.anilistId)}
              currentAnimeId={rawAnime.id}
            />
          </Suspense>
        )}
      </div>
    );
  }

  // ── Single-link or no-link: existing single-anime layout ────────────────────
  const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    FINISHED:         { label: "Finished",          className: "bg-green-900/50 text-green-400 border border-green-800" },
    RELEASING:        { label: "Currently Airing",  className: "bg-blue-900/50 text-blue-400 border border-blue-800" },
    HIATUS:           { label: "On Hiatus",         className: "bg-amber-900/50 text-amber-400 border border-amber-800" },
    CANCELLED:        { label: "Cancelled",         className: "bg-red-900/50 text-red-400 border border-red-800" },
    NOT_YET_RELEASED: { label: "Not Yet Released",  className: "bg-slate-700/50 text-slate-400 border border-slate-600" },
  };

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex gap-6">
        <div className="relative w-32 h-48 flex-shrink-0 rounded-lg overflow-hidden bg-slate-800">
          {rawAnime.coverImageUrl ? (
            <Image src={rawAnime.coverImageUrl} alt={title} fill className="object-cover" unoptimized />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs text-center px-2">No cover</div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          {rawAnime.titleRomaji !== title && (
            <p className="text-slate-400 text-sm">{rawAnime.titleRomaji}</p>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            {entry && <StatusBadge status={entry.watchStatus} />}
            <span className="text-xs text-slate-500">{rawAnime.displayFormat}</span>
            {(() => {
              const cfg = STATUS_CONFIG[airingStatus] ?? { label: airingStatus, className: "bg-slate-800 text-slate-400 border border-slate-700" };
              return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>{cfg.label}</span>;
            })()}
            {rawAnime.season && rawAnime.seasonYear && (
              <span className="text-xs text-slate-500">{rawAnime.season} {rawAnime.seasonYear}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <span key={g} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">{g}</span>
            ))}
          </div>
          {mainStudios.length > 0 && (
            <p className="text-sm text-slate-400">
              {mainStudios.map((s) => s.studio.name).join(", ")}
            </p>
          )}
          {rawAnime.meanScore && (
            <p className="text-sm text-slate-400">
              Community score: <span className="text-white font-medium">{rawAnime.meanScore}/100</span>
            </p>
          )}
          {totalEpisodes && (
            <p className="text-sm text-slate-400">
              {rawAnime.totalSeasons && rawAnime.totalSeasons > 1
                ? `${totalEpisodes} episodes (${rawAnime.totalSeasons} seasons)`
                : `${totalEpisodes} episodes`}
              {rawAnime.durationMins && ` · ${rawAnime.durationMins} min/ep`}
            </p>
          )}
          {rawAnime.franchiseEntries.length > 0 && (
            <p className="text-sm text-slate-400">
              Franchise:{" "}
              {rawAnime.franchiseEntries.map((fe) => (
                <a key={fe.franchise.id} href={`/franchises/${fe.franchise.id}`} className="text-indigo-400 hover:text-indigo-300">
                  {fe.franchise.name}
                </a>
              ))}
            </p>
          )}
        </div>
      </div>

      <div>
        {rawAnime.synopsis && (
          <>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Synopsis</h3>
            <p className="text-sm text-slate-400 leading-relaxed line-clamp-6">{rawAnime.synopsis}</p>
          </>
        )}
        <AnimeMetaEdit anime={rawAnime} />
      </div>

      {(rawAnime.anilistId || rawAnime.tmdbId || rawAnime.externalUrl) && (
        <div className="flex flex-wrap gap-4">
          {rawAnime.anilistId && (
            <a href={`https://anilist.co/anime/${rawAnime.anilistId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              View on AniList ↗
            </a>
          )}
          {rawAnime.tmdbId && (
            <a href={`https://www.themoviedb.org/${rawAnime.tmdbMediaType ?? "tv"}/${rawAnime.tmdbId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              View on TMDB ↗
            </a>
          )}
          {rawAnime.externalUrl && (
            <a href={rawAnime.externalUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              External Link ↗
            </a>
          )}
        </div>
      )}

      {/* Link management — always shown so user can add a linked anime */}
      {link && (
        <LinkManager
          linkId={link.id}
          linkedAnime={link.linkedAnime.map((la) => ({
            id: la.id,
            order: la.order,
            anime: {
              id: la.anime.id,
              titleRomaji: la.anime.titleRomaji,
              titleEnglish: la.anime.titleEnglish,
              anilistId: la.anime.anilistId,
              season: la.anime.season,
              seasonYear: la.anime.seasonYear,
              totalEpisodes: la.anime.totalEpisodes,
              airingStatus: la.anime.airingStatus,
            },
          }))}
        />
      )}

      {rawAnime.anilistId && (
        <Suspense fallback={null}>
          <RelatedAnime
            anilistId={rawAnime.anilistId}
            userId={userId}
            franchiseIds={rawAnime.franchiseEntries.map((fe) => fe.franchise.id)}
            linkId={link?.id ?? null}
            linkedAnilistIds={link?.linkedAnime.map((la) => la.anime.anilistId) ?? []}
            currentAnimeId={rawAnime.id}
          />
        </Suspense>
      )}

      <StreamingAutoRefresh animeId={rawAnime.id} source={rawAnime.source} streamingCheckedAt={rawAnime.streamingCheckedAt} lastSyncedAt={rawAnime.lastSyncedAt} />
      <WhereToWatch animeId={rawAnime.id} initialLinks={rawAnime.streamingLinks} />

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Your Review</h3>
        <AnimeEditForm
          anime={rawAnime}
          entry={entry}
          people={people}
          franchises={franchises}
          linkedAnime={linkedAnimeSeasonsForForm}
        />
      </div>

      {rawAnime.streamingCheckedAt && (
        <p className="text-xs text-slate-600" title={new Date(rawAnime.streamingCheckedAt).toLocaleString()}>
          Last updated {formatRelativeDate(rawAnime.streamingCheckedAt)}
        </p>
      )}
    </div>
  );
}
