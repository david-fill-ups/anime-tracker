export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import FranchiseDetail from "@/components/FranchiseDetail";

export default async function FranchiseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [franchise, allAnime] = await Promise.all([
    db.franchise.findUnique({
      where: { id: Number(id) },
      include: {
        entries: {
          orderBy: { order: "asc" },
          include: { anime: { include: { userEntry: true } } },
        },
      },
    }),
    db.anime.findMany({
      where: { userEntry: { isNot: null } },
      orderBy: { titleRomaji: "asc" },
    }),
  ]);

  if (!franchise) notFound();

  return (
    <div className="max-w-2xl">
      <FranchiseDetail franchise={franchise} allAnime={allAnime} />
    </div>
  );
}
