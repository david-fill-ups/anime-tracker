export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AddAnimeForm from "@/components/AddAnimeForm";

export default async function AddAnimePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const people = await db.person.findMany({ where: { userId }, orderBy: { name: "asc" } });
  const franchises = await db.franchise.findMany({ where: { userId }, orderBy: { name: "asc" } });
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Add Anime</h2>
      <AddAnimeForm people={people} franchises={franchises} />
    </div>
  );
}
