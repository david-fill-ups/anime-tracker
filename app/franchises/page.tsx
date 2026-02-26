export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import Link from "next/link";
import FranchiseManager from "@/components/FranchiseManager";

export default async function FranchisesPage() {
  const franchises = await db.franchise.findMany({
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: {
          anime: {
            include: { userEntry: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Franchises</h2>
      </div>

      <FranchiseManager franchises={franchises} />
    </div>
  );
}
