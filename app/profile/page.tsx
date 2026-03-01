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
    </div>
  );
}
