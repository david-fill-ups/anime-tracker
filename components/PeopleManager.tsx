"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PersonStats = {
  id: number;
  name: string;
  totalRecommendations: number;
  completedCount: number;
  ratedCount: number;
  avgScore: number | null;
  recentRecommendations: { title: string; status: string; score: number | null }[];
};

export default function PeopleManager({ people }: { people: PersonStats[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

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

  async function saveName(id: number) {
    await fetch(`/api/people/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setEditingId(null);
    router.refresh();
  }

  async function deletePerson(id: number) {
    if (!confirm("Delete this person? Their recommendations will be unlinked.")) return;
    await fetch(`/api/people/${id}`, { method: "DELETE" });
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
            <div className="flex items-start justify-between mb-3">
              {editingId === person.id ? (
                <div className="flex gap-2 flex-1 mr-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(person.id); if (e.key === "Escape") setEditingId(null); }}
                    onBlur={() => saveName(person.id)}
                    autoFocus
                    className="flex-1 bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => setEditingId(null)} className="text-xs text-slate-400">Done</button>
                </div>
              ) : (
                <h3 className="font-semibold text-white">{person.name}</h3>
              )}
              <div className="flex gap-2">
                {editingId !== person.id && (
                  <button
                    onClick={() => { setEditingId(person.id); setEditName(person.name); }}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => deletePerson(person.id)}
                  className="text-xs text-red-600 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <p className="text-lg font-bold text-white">{person.totalRecommendations}</p>
                <p className="text-xs text-slate-500">Recommended</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">{person.completedCount}</p>
                <p className="text-xs text-slate-500">Completed</p>
              </div>
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
                    <span className="text-slate-400 truncate flex-1">{r.title}</span>
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
