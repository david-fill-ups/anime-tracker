"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/library", label: "Library" },
  { href: "/franchises", label: "Franchises" },
  { href: "/people", label: "People" },
  { href: "/stats", label: "Stats" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-lg font-bold text-white tracking-tight">Anime Tracker</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <Link
          href="/library/add"
          className="block w-full text-center px-3 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          + Add Anime
        </Link>
      </div>
    </aside>
  );
}
