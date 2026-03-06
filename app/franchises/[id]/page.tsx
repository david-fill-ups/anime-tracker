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
          include: { anime: { include: { userEntries: { where: { userId }, take: 1 } } } },
        },
      },
    }),
    db.anime.findMany({
      where: {
        userEntries: { some: { userId } },
        mergedIntoId: null,
        franchiseEntries: { none: { franchise: { userId } } },
      },
      orderBy: { titleRomaji: "asc" },
    }),
  ]);

  if (!rawFranchise) notFound();

  // Transform nested userEntries[] -> userEntry; exclude merged secondaries from display
  const franchise = {
    ...rawFranchise,
    entries: rawFranchise.entries
      .filter((e) => e.anime.mergedIntoId === null)
      .map((e) => ({
        ...e,
        anime: { ...e.anime, userEntry: e.anime.userEntries[0] ?? null },
      })),
  };

  return (
    <div className="max-w-2xl">
      <FranchiseDetail franchise={franchise} allAnime={allAnime} />
    </div>
  );
}
