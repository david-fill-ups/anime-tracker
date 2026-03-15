export const dynamic = "force-dynamic";
import Image from "next/image";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ProfileActions from "@/components/ProfileActions";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = session.user;

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        {user.image && (
          <Image
            src={user.image}
            alt={user.name ?? "User"}
            width={48}
            height={48}
            className="rounded-full"
          />
        )}
        <div>
          <h2 className="text-2xl font-bold text-white">{user.name ?? "Profile"}</h2>
          {user.email && <p className="text-sm text-slate-400">{user.email}</p>}
        </div>
      </div>

      <ProfileActions />

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">API Reference</h3>
        <p className="text-xs text-slate-500 mb-3">
          Browse the full REST API — schemas stay in sync with the codebase automatically.
        </p>
        <a
          href="/docs"
          className="inline-block px-4 py-2 rounded-md text-sm font-medium bg-slate-800 hover:bg-slate-700 text-white transition-colors"
        >
          View API Docs
        </a>
      </div>
    </div>
  );
}
