"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";


export default function NavLinks() {
  const pathname = usePathname();
  const [libraryUrl, setLibraryUrl] = useState("/library");

  useEffect(() => {
    const saved = sessionStorage.getItem("libraryUrl");
    if (saved) setLibraryUrl(saved);
  }, [pathname]);

  const allLinks = [
    { href: "/watching", label: "Watching", match: "/watching" },
    { href: libraryUrl, label: "Library", match: "/library" },
    { href: "/backlog", label: "Backlog", match: "/backlog" },
    { href: "/franchises", label: "Franchises", match: "/franchises" },
    { href: "/people", label: "People", match: "/people" },
    { href: "/stats", label: "Dashboard", match: "/stats" },
  ];

  return (
    <nav className="flex-1 p-4 space-y-1">
      {allLinks.map(({ href, label, match }) => {
        const active = pathname === match || pathname.startsWith(match + "/");
        return (
          <Link
            key={label}
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
  );
}
