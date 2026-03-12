"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PersonActions({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [saving, setSaving] = useState(false);

  async function saveName() {
    if (!editName.trim() || editName.trim() === name) { setEditing(false); return; }
    setSaving(true);
    await fetch(`/api/people/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function deletePerson() {
    if (!confirm("Delete this person? Their recommendations will be unlinked.")) return;
    await fetch(`/api/people/${id}`, { method: "DELETE" });
    router.push("/people");
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditing(false); }}
          autoFocus
          className="bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-500"
        />
        <button onClick={saveName} disabled={saving} className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50">Save</button>
        <button onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:text-slate-300">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={() => { setEditName(name); setEditing(true); }} className="text-sm text-slate-400 hover:text-white transition-colors">
        Rename
      </button>
      <button onClick={deletePerson} className="text-sm text-red-600 hover:text-red-400 transition-colors">
        Delete
      </button>
    </div>
  );
}
