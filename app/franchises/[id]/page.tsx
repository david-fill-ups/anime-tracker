export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import FranchiseDetail from "@/components/FranchiseDetail";

export default async function FranchiseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;

  const [rawFranchise, allAnime] = await Promise.all([
    db.franchise.findFirst({
      where: { id: Number(id), userId },
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
    }),
    db.anime.findMany({
      where: {
        linkedIn: { some: { order: 0, link: { userId } } },
        franchiseEntries: { none: { franchise: { userId } } },
      },
      orderBy: { titleRomaji: "asc" },
    }),
  ]);

  if (!rawFranchise) notFound();

  // Transform: extract userEntry from link; exclude non-primary linked anime from display
  const franchise = {
    ...rawFranchise,
    entries: rawFranchise.entries
      .filter((e) => {
        const userLinked = e.anime.linkedIn[0];
        return !userLinked || userLinked.order === 0;
      })
      .map((e) => ({
        ...e,
        anime: { ...e.anime, userEntry: e.anime.linkedIn[0]?.link.userEntry ?? null },
      })),
  };

  return (
    <div className="max-w-2xl">
      <FranchiseDetail franchise={franchise} allAnime={allAnime} />
    </div>
  );
}
