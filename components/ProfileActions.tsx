"use client";

import { useState, useRef } from "react";
import { signOut } from "next-auth/react";

type RefreshResult = { synced: number; errors: number; total: number };
type ImportResult = { imported: number; updated: number; errors: number };

export default function ProfileActions() {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleRefreshAll() {
    setRefreshing(true);
    setRefreshResult(null);
    setRefreshError(null);
    try {
      const res = await fetch("/api/sync-all", { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      const data = await res.json();
      setRefreshResult(data);
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setImportError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Import failed");
      }
      const data = await res.json();
      setImportResult(data);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleDeleteProfile() {
    setDeleting(true);
    try {
      const res = await fetch("/api/profile/delete", { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await signOut({ callbackUrl: "/login" });
    } catch (e) {
      setDeleting(false);
      setShowDeleteConfirm(false);
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      {/* Export Data */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Export Data</h3>
        <p className="text-xs text-slate-500 mb-3">Download your full library as a CSV file.</p>
        <a
          href="/api/export"
          className="inline-block px-4 py-2 rounded-md text-sm font-medium bg-slate-800 hover:bg-slate-700 text-white transition-colors"
        >
          Download CSV
        </a>
      </div>

      {/* Import Data */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Import Data</h3>
        <p className="text-xs text-slate-500 mb-3">
          Import from a CSV exported by this app. Existing entries will be updated; new AniList
          entries will be fetched and added automatically.
        </p>
        <form onSubmit={handleImport} className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            disabled={importing}
            className="text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-slate-800 file:text-white hover:file:bg-slate-700 file:cursor-pointer"
          />
          <button
            type="submit"
            disabled={importing}
            className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import"}
          </button>
        </form>
        {importResult && (
          <p className="text-xs text-green-400 mt-2">
            {importResult.imported} added, {importResult.updated} updated
            {importResult.errors > 0 && `, ${importResult.errors} errors`}.
          </p>
        )}
        {importError && <p className="text-xs text-red-400 mt-2">{importError}</p>}
      </div>

      {/* Refresh All */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Refresh All</h3>
        <p className="text-xs text-slate-500 mb-3">
          Re-fetch all AniList metadata and streaming links for your entire library.
        </p>
        <button
          onClick={handleRefreshAll}
          disabled={refreshing}
          className="px-4 py-2 rounded-md text-sm font-medium bg-slate-800 hover:bg-slate-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {refreshing && (
            <svg
              className="animate-spin h-4 w-4 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {refreshing ? "Refreshing…" : "Refresh All"}
        </button>
        {refreshResult && (
          <p className="text-xs text-green-400 mt-2">
            Refreshed {refreshResult.synced}/{refreshResult.total} entries.
            {refreshResult.errors > 0 && ` ${refreshResult.errors} errors.`}
          </p>
        )}
        {refreshError && <p className="text-xs text-red-400 mt-2">{refreshError}</p>}
      </div>

      {/* Delete Profile */}
      <div className="bg-slate-900 border border-red-900/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Delete Profile</h3>
        <p className="text-xs text-slate-500 mb-3">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 rounded-md text-sm font-medium bg-red-900/60 hover:bg-red-800 text-red-300 hover:text-white transition-colors"
          >
            Delete Profile
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-400 font-medium">
              Are you sure? This will permanently delete your account and all your data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteProfile}
                disabled={deleting}
                className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete everything"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-md text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
