export const dynamic = "force-dynamic";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Suspense } from "react";
import LibraryFiltersForm from "@/components/LibraryFiltersForm";

export default async function LibraryFiltersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const params = await searchParams;

  const [franchises, people, genreAnimes, studioAnimes] = await Promise.all([
    db.franchise.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.person.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.anime.findMany({
      where: { linkedIn: { some: { order: 0, link: { userId } } } },
      select: { genres: true },
    }),
    db.anime.findMany({
      where: { linkedIn: { some: { order: 0, link: { userId } } } },
      select: { animeStudios: { where: { isMainStudio: true }, include: { studio: true } } },
    }),
  ]);

  // Collect distinct genres from the user's library
  const genreSet = new Set<string>();
  for (const a of genreAnimes) {
    try {
      const parsed: string[] = JSON.parse(a.genres || "[]");
      for (const g of parsed) genreSet.add(g);
    } catch {
      // ignore malformed JSON
    }
  }
  const genres = Array.from(genreSet).sort();

  // Collect distinct main studios from the user's library
  const studioSet = new Set<string>();
  for (const a of studioAnimes) {
    for (const s of a.animeStudios) studioSet.add(s.studio.name);
  }
  const studios = Array.from(studioSet).sort();

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-white">Filters</h2>
      <Suspense>
        <LibraryFiltersForm
          franchises={franchises}
          people={people}
          genres={genres}
          studios={studios}
          initialParams={params}
        />
      </Suspense>
    </div>
  );
}
