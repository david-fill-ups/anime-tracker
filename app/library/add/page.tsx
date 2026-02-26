export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import AddAnimeForm from "@/components/AddAnimeForm";

export default async function AddAnimePage() {
  const people = await db.person.findMany({ orderBy: { name: "asc" } });
  const franchises = await db.franchise.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Add Anime</h2>
      <AddAnimeForm people={people} franchises={franchises} />
    </div>
  );
}
