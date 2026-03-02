"use client";

import { useState } from "react";

export default function AboutModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-slate-500 hover:text-slate-400 text-xs transition-colors"
      >
        About this project
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-base font-semibold text-white">About this project</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none mt-0.5"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-medium text-slate-300 uppercase tracking-wide">What is this?</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                A personal anime tracking app built around franchise awareness. Track shows with statuses
                (Watching, Completed, Plan to Watch, etc.), log episode progress, and score what you&apos;ve seen.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                When you sync a title, AniList relation data automatically wires up its sequels, prequels,
                and spin-offs into a shared franchise. The Queue page acts as a recommendation engine from
                there — it scans every franchise you&apos;ve started, surfaces all related entries you haven&apos;t
                tracked yet (ordered by their position in the franchise), and lets you mark each one
                Interested or Not Interested to manage your Plan to Watch.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Syncing also cross-references TMDB: it auto-detects which streaming services currently
                carry the title in your region (Netflix, Crunchyroll, Hulu, Disney+, Prime, HBO, HiDive)
                and stores search links — subscription and free tiers only. TMDB also fills in per-season
                episode counts for multi-season series.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Stats break down your library by hours watched (calculated from episode progress × runtime),
                score distribution, top genres, and your average rating per studio — all linked back to
                filtered library views.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-medium text-slate-300 uppercase tracking-wide">Tech stack &amp; hosting</h3>
              <ul className="space-y-2">
                {[
                  { name: "Next.js", desc: "The React framework powering the app — handles routing, server-side rendering, and API endpoints." },
                  { name: "TypeScript", desc: "Typed JavaScript. Catches bugs at compile time rather than at runtime." },
                  { name: "Tailwind CSS", desc: "Utility-first CSS framework used for all styling — no separate stylesheet files." },
                  { name: "Prisma ORM", desc: "Handles all database reads and writes. Lets you work with the database using TypeScript instead of raw SQL." },
                  { name: "PostgreSQL", desc: "The relational database storing all user data — anime entries, ratings, franchises, etc." },
                  { name: "NextAuth v5", desc: "Authentication library managing the Google sign-in flow and user sessions." },
                  { name: "AniList API", desc: "Third-party GraphQL API used to pull anime metadata (titles, covers, descriptions, episode counts)." },
                  { name: "TMDB API", desc: "The Movie Database API, used to supplement metadata — particularly for streaming availability and additional media info." },
                  { name: "Vercel", desc: "Hosting platform where the app is deployed. Handles CI/CD — every push to main goes live automatically." },
                ].map(({ name, desc }) => (
                  <li key={name} className="grid grid-cols-[8rem_1fr] gap-3 items-baseline">
                    <span className="text-xs font-medium text-slate-200 text-right">{name}</span>
                    <p className="text-xs text-slate-400 leading-relaxed text-left">{desc}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-medium text-slate-300 uppercase tracking-wide">Want access?</h3>
              <p className="text-sm text-slate-400">
                Email{" "}
                <a
                  href="mailto:phillipsdavidpaul@gmail.com"
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  phillipsdavidpaul@gmail.com
                </a>{" "}
                to be added as a tester.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <a
                href="https://www.linkedin.com/in/davidpaulphillips/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                Connect on LinkedIn
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
