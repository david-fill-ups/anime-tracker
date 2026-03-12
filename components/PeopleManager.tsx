"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type PersonStats = {
  id: number;
  name: string;
  totalRecommendations: number;
  completedCount: number;
  ratedCount: number;
  avgScore: number | null;
  recentRecommendations: { animeId: number | null; title: string; status: string; score: number | null }[];
};

export default function PeopleManager({ people }: { people: PersonStats[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function createPerson() {
    if (!newName.trim()) return;
    setSubmitting(true);
    await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setCreating(false);
    setNewName("");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          + Add Person
        </button>
      ) : (
        <div className="flex gap-2 max-w-sm">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createPerson()}
            autoFocus
            placeholder="Name"
            className="flex-1 bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
          <button onClick={() => setCreating(false)} className="text-sm text-slate-400 border border-slate-700 px-3 py-2 rounded-md">Cancel</button>
          <button
            onClick={createPerson}
            disabled={submitting || !newName.trim()}
            className="text-sm bg-indigo-600 text-white px-3 py-2 rounded-md disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {people.length === 0 && (
        <p className="text-slate-500 text-sm">No people yet. Add someone to start tracking recommendations.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {people.map((person) => (
          <div key={person.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="mb-3">
              <Link href={`/people/${person.id}`} className="font-semibold text-white hover:text-indigo-400 transition-colors">
                {person.name}
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Link href={`/backlog?recommender=${person.id}`} className="text-center group">
                <p className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{person.totalRecommendations}</p>
                <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">Recommended</p>
              </Link>
              <Link href={`/library?recommender=${person.id}&status=COMPLETED`} className="text-center group">
                <p className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{person.completedCount}</p>
                <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">Completed</p>
              </Link>
              <div className="text-center">
                <p className="text-lg font-bold text-yellow-400">
                  {person.avgScore != null ? person.avgScore : "—"}
                </p>
                <p className="text-xs text-slate-500">Avg Score</p>
              </div>
            </div>

            {/* Recent recommendations */}
            {person.recentRecommendations.length > 0 && (
              <div className="space-y-1 border-t border-slate-800 pt-3">
                {person.recentRecommendations.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    {r.animeId != null ? (
                      <Link href={`/anime/${r.animeId}`} className="text-slate-400 hover:text-indigo-400 truncate flex-1 transition-colors">{r.title}</Link>
                    ) : (
                      <span className="text-slate-400 truncate flex-1">{r.title}</span>
                    )}
                    {r.score != null && (
                      <span className="text-yellow-400 ml-2">★ {r.score}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
