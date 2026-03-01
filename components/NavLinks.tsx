"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/library", label: "Library" },
  { href: "/queue", label: "Queue" },
  { href: "/franchises", label: "Franchises" },
  { href: "/people", label: "People" },
  { href: "/stats", label: "Stats" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
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
  );
}
