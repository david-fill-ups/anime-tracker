"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import NavLinks from "./NavLinks";
import { useSpotlight } from "./SpotlightContext";
import { signOutAction } from "@/app/actions/auth";
import type { Session } from "next-auth";

export default function SidebarShell({ user }: { user: Session["user"] }) {
  const { spotlight: anime, setSpotlight } = useSpotlight();
  const [shuffling, setShuffling] = useState(false);

  async function shuffle() {
    setShuffling(true);
    const res = await fetch("/api/sidebar-feature");
    if (res.ok) {
      const data = (await res.json()).anime;
      if (data) setSpotlight(data);
    }
    setShuffling(false);
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-slate-950 border-r border-slate-800 flex flex-col overflow-hidden">

      {/* Atmospheric blurred background */}
      {anime && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none select-none"
            style={{
              backgroundImage: `url(${anime.coverImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(0px)",
              transform: "scale(1.08)",
              opacity: 0.3,
            }}
          />
          <div className="absolute inset-0 bg-slate-950/70 pointer-events-none" />
        </>
      )}

      {/* Content sits above background layers */}
      <div className="relative z-10 flex flex-col flex-1 min-h-0">

        {/* Header */}
        <div className="p-6 border-b border-slate-800/60 space-y-3">
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

        {/* Nav links */}
        <NavLinks />

        {/* Bottom section */}
        <div className="p-4 border-t border-slate-800/60 space-y-3">

          {/* Spotlight card — clicking it shuffles to a different anime */}
          {anime && (
            <button
              onClick={shuffle}
              disabled={shuffling}
              className="w-full flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 backdrop-blur-sm hover:bg-slate-800/60 transition-colors text-left disabled:opacity-50"
              title="Click to shuffle"
              suppressHydrationWarning
            >
              <img
                src={anime.coverImageUrl}
                alt={anime.title}
                className="w-8 h-12 object-cover rounded shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Spotlight</p>
                <p className="text-xs text-slate-200 font-medium truncate leading-tight">{anime.title}</p>
                {anime.score !== null && (
                  <p className="text-[10px] text-yellow-400 mt-0.5">★ {anime.score}</p>
                )}
              </div>
              <span className="text-slate-600 text-xs shrink-0">↻</span>
            </button>
          )}

          <Link
            href="/library/add"
            className="block w-full text-center px-3 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            + Add Anime
          </Link>

          <form action={signOutAction}>
            <button
              type="submit"
              className="block w-full text-center px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
