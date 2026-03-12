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
    },
    orderBy: { name: "asc" },
  });

  const peopleWithStats = people.map((person) => {
    const completed = person.entries.filter((e) => e.watchStatus === "COMPLETED");
    const rated = completed.filter((e) => e.score !== null);
    const avgScore = rated.length
      ? Math.round((rated.reduce((s, e) => s + (e.score ?? 0), 0) / rated.length) * 10) / 10
      : null;
    return {
      id: person.id,
      name: person.name,
      totalRecommendations: person.entries.length,
      completedCount: completed.length,
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
      <PeopleManager people={peopleWithStats} />
    </div>
  );
}
