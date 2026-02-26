export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Image from "next/image";
import StatusBadge from "@/components/StatusBadge";
import AnimeEditForm from "@/components/AnimeEditForm";

export default async function AnimeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const anime = await db.anime.findUnique({
    where: { id: Number(id) },
    include: {
      userEntry: { include: { recommender: true } },
      franchiseEntries: { include: { franchise: true }, orderBy: { order: "asc" } },
      animeStudios: { include: { studio: true } },
    },
  });

  if (!anime) notFound();

  const entry = anime.userEntry;
  const genres: string[] = JSON.parse(anime.genres || "[]");
  const mainStudios = anime.animeStudios.filter((s) => s.isMainStudio);
  const title = anime.titleEnglish || anime.titleRomaji;

  const people = await db.person.findMany({ orderBy: { name: "asc" } });
  const franchises = await db.franchise.findMany({ orderBy: { name: "asc" } });

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
              {anime.totalEpisodes} episodes
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

      {anime.synopsis && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Synopsis</h3>
          <p className="text-sm text-slate-400 leading-relaxed line-clamp-6">{anime.synopsis}</p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Your Entry</h3>
        <AnimeEditForm anime={anime} entry={entry} people={people} franchises={franchises} />
      </div>
    </div>
  );
}
