import Link from "next/link";
import Image from "next/image";
import NavLinks from "@/components/NavLinks";
import { signOutAction } from "@/app/actions/auth";
import type { Session } from "next-auth";

type Props = {
  user: Session["user"];
};

export default function Nav({ user }: Props) {
  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-6 border-b border-slate-800 space-y-3">
        <h1 className="text-lg font-bold text-white tracking-tight">Anime Tracker</h1>
        <Link href="/profile" className="flex items-center gap-2 px-1 hover:opacity-80 transition-opacity">
          {user.image && (
            <Image
              src={user.image}
              alt={user.name ?? "User"}
              width={28}
              height={28}
              className="rounded-full shrink-0"
            />
          )}
          <span className="text-xs text-slate-400 truncate flex-1 min-w-0">
            {user.name ?? user.email}
          </span>
        </Link>
      </div>

      <NavLinks />

      <div className="p-4 border-t border-slate-800 space-y-3">
        <Link
          href="/library/add"
          className="block w-full text-center px-3 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          + Add Anime
        </Link>

        <form action={signOutAction}>
          <button
            type="submit"
            className="block w-full text-center px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
