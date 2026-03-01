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
            include: { userEntries: { where: { userId }, take: 1 } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Transform nested userEntries[] -> userEntry; exclude merged secondaries from display
  const franchises = rawFranchises.map((f) => ({
    ...f,
    entries: f.entries
      .filter((e) => e.anime.mergedIntoId === null)
      .map((e) => ({
        ...e,
        anime: { ...e.anime, userEntry: e.anime.userEntries[0] ?? null },
      })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Franchises</h2>
      </div>

      <FranchiseManager franchises={franchises} />
    </div>
  );
}
