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
import SeasonsMerge from "@/components/SeasonsMerge";
import { effectiveTotalEpisodes, effectiveAiringStatus, MERGED_ANIME_SELECT } from "@/lib/anime-utils";
import type { AiringStatus } from "@/app/generated/prisma";

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
      userEntries: {
        where: { userId },
        include: { recommender: true, watchContextPerson: true },
        take: 1,
      },
      franchiseEntries: { include: { franchise: true }, orderBy: { order: "asc" } },
      animeStudios: { include: { studio: true } },
      streamingLinks: { orderBy: { service: "asc" } },
      mergedAnimes: { select: MERGED_ANIME_SELECT, orderBy: { seasonYear: "asc" as const } },
    },
  });

  if (!rawAnime) notFound();

  // Transform for component compatibility: userEntries[] -> userEntry
  const { userEntries, ...animeRest } = rawAnime;
  const anime = { ...animeRest, userEntry: userEntries[0] ?? null };

  const entry = anime.userEntry;
  const genres: string[] = JSON.parse(anime.genres || "[]");
  const mainStudios = anime.animeStudios.filter((s) => s.isMainStudio);
  const title = anime.titleEnglish || anime.titleRomaji;

  const [people, franchises] = await Promise.all([
    db.person.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.franchise.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex gap-6">
        <div className="relative w-32 h-48 flex-shrink-0 rounded-lg overflow-hidden bg-slate-800">
          {anime.coverImageUrl ? (
            <Image src={anime.coverImageUrl} alt={title} fill className="object-cover" unoptimized />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs text-center px-2">No cover</div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          {anime.titleRomaji !== title && (
            <p className="text-slate-400 text-sm">{anime.titleRomaji}</p>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            {entry && <StatusBadge status={entry.watchStatus} />}
            <span className="text-xs text-slate-500">{anime.displayFormat}</span>
            <span className="text-xs text-slate-500">{anime.airingStatus}</span>
            {anime.season && anime.seasonYear && (
              <span className="text-xs text-slate-500">{anime.season} {anime.seasonYear}</span>
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
          {anime.meanScore && (
            <p className="text-sm text-slate-400">
              Community score: <span className="text-white font-medium">{anime.meanScore}/100</span>
            </p>
          )}
          {anime.totalEpisodes && (
            <p className="text-sm text-slate-400">
              {anime.totalSeasons && anime.totalSeasons > 1
                ? `${anime.totalSeasons * anime.totalEpisodes} episodes (${anime.totalSeasons} seasons × ${anime.totalEpisodes} ep)`
                : `${anime.totalEpisodes} episodes`}
              {anime.durationMins && ` · ${anime.durationMins} min/ep`}
            </p>
          )}
          {anime.franchiseEntries.length > 0 && (
            <p className="text-sm text-slate-400">
              Franchise:{" "}
              {anime.franchiseEntries.map((fe) => (
                <a key={fe.franchise.id} href={`/franchises/${fe.franchise.id}`} className="text-indigo-400 hover:text-indigo-300">
                  {fe.franchise.name}
                </a>
              ))}
            </p>
          )}
        </div>
      </div>

      <div>
        {anime.synopsis && (
          <>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Synopsis</h3>
            <p className="text-sm text-slate-400 leading-relaxed line-clamp-6">{anime.synopsis}</p>
          </>
        )}
        <AnimeMetaEdit anime={anime} />
      </div>

      {(anime.anilistId || anime.tmdbId || anime.externalUrl) && (
        <div className="flex flex-wrap gap-4">
          {anime.anilistId && (
            <a
              href={`https://anilist.co/anime/${anime.anilistId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View on AniList ↗
            </a>
          )}
          {anime.tmdbId && (
            <a
              href={`https://www.themoviedb.org/${anime.tmdbMediaType ?? "tv"}/${anime.tmdbId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View on TMDB ↗
            </a>
          )}
          {anime.externalUrl && (
            <a
              href={anime.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              External Link ↗
            </a>
          )}
        </div>
      )}

      <StreamingAutoRefresh animeId={anime.id} source={anime.source} />
      <WhereToWatch animeId={anime.id} initialLinks={anime.streamingLinks} />

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Your Review</h3>
        <AnimeEditForm anime={anime} entry={entry} people={people} franchises={franchises} />
      </div>

      {anime.streamingCheckedAt && (
        <p className="text-xs text-slate-600" title={new Date(anime.streamingCheckedAt).toLocaleString()}>
          Last updated {formatRelativeDate(anime.streamingCheckedAt)}
        </p>
      )}
    </div>
  );
}
