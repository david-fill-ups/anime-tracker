export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import FranchiseManager from "@/components/FranchiseManager";

export default async function FranchisesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const rawFranchises = await db.franchise.findMany({
    where: { userId },
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
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Transform: extract userEntry from link; exclude non-primary linked anime from display
  const franchises = rawFranchises.map((f) => ({
    ...f,
    entries: f.entries
      .filter((e) => {
        const userLinked = e.anime.linkedIn[0];
        return !userLinked || userLinked.order === 0;
      })
      .map((e) => ({
        ...e,
        anime: { ...e.anime, userEntry: e.anime.linkedIn[0]?.link.userEntry ?? null },
      })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Franchises</h2>
      </div>

      {franchises.length === 0 && (
        <div className="text-center py-24 text-slate-500">
          <p className="text-lg">No franchises yet</p>
          <p className="text-sm mt-1">Franchises are auto-created when you add anime from AniList, or you can create one manually.</p>
        </div>
      )}

      <FranchiseManager franchises={franchises} />
    </div>
  );
}
