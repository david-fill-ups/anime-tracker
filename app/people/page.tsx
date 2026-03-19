export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PeopleManager from "@/components/PeopleManager";

export default async function PeoplePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const people = await db.person.findMany({
    where: { userId },
    include: {
      entries: {
        include: {
          link: {
            include: {
              linkedAnime: { orderBy: { order: "asc" }, take: 1, include: { anime: true } },
            },
          },
        },
      },
      watchContextEntries: {
        select: { watchStatus: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const peopleWithStats = people.map((person) => {
    const completed = person.watchContextEntries.filter((e) => e.watchStatus === "COMPLETED");
    const watching = person.watchContextEntries.filter((e) => e.watchStatus === "WATCHING");
    const rated = person.entries.filter((e) => e.score !== null);
    const avgScore = rated.length
      ? Math.round((rated.reduce((s, e) => s + (e.score ?? 0), 0) / rated.length) * 10) / 10
      : null;
    return {
      id: person.id,
      name: person.name,
      totalRecommendations: person.entries.length,
      completedCount: completed.length,
      watchingCount: watching.length,
      ratedCount: rated.length,
      avgScore,
      recentRecommendations: person.entries.slice(0, 3).map((e) => {
        const anime = e.link?.linkedAnime[0]?.anime;
        return {
          animeId: anime?.id ?? null,
          title: anime ? (anime.titleEnglish || anime.titleRomaji) : "(unknown)",
          status: e.watchStatus,
          score: e.score,
        };
      }),
    };
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">People</h2>
      <p className="text-sm text-slate-400">Track who recommends anime to you and how their taste aligns with yours.</p>
      {peopleWithStats.length === 0 && (
        <div className="text-center py-24 text-slate-500">
          <p className="text-lg">No people yet</p>
          <p className="text-sm mt-1">Add a recommender or watch partner from any anime detail page.</p>
        </div>
      )}
      <PeopleManager people={peopleWithStats} />
    </div>
  );
}
