"use client";

import { useRouter } from "next/navigation";
import AnimeCard from "./AnimeCard";
import type { Anime, UserEntry, Person } from "@/app/generated/prisma";

type AnimeWithEntry = Anime & {
  userEntry: (UserEntry & { recommender: Person | null }) | null;
  franchiseEntries: { franchise: { name: string }; order: number }[];
  animeStudios: { studio: { name: string }; isMainStudio: boolean }[];
};

export default function AnimeGrid({ animes }: { animes: AnimeWithEntry[] }) {
  const router = useRouter();

  if (animes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <p className="text-lg">No anime found</p>
        <p className="text-sm mt-1">Try adjusting your filters or add something new.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {animes.map((anime) => (
        <AnimeCard
          key={anime.id}
          anime={anime}
          onUpdate={() => router.refresh()}
        />
      ))}
    </div>
  );
}
