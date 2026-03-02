"use client";

import { useState, useRef } from "react";
import { signOut } from "next-auth/react";

type RefreshResult = { synced: number; errors: number; total: number };
type ImportResult = { imported: number; updated: number; skipped: number; errors: number };
type PreviewResult = { newCount: number; existingCount: number; invalidCount: number };

export default function ProfileActions() {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Refresh failed");
      }
      const data = await res.json();
      setRefreshResult(data);
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function doImport(file: File, conflictMode: "update" | "skip") {
    setImporting(true);
    setPreviewData(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("conflictMode", conflictMode);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Import failed");
      }
      const data: ImportResult = await res.json();
      setImportResult(data);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setPendingFile(null);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleImport(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setPendingFile(file);
    setPreviewing(true);
    setPreviewData(null);
    setImportResult(null);
    setImportError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "preview");
      const res = await fetch("/api/import", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Validation failed");
      }
      const data: PreviewResult = await res.json();
      setPreviewing(false);

      if (data.existingCount === 0) {
        // No conflicts — import directly without prompting
        await doImport(file, "update");
      } else {
        // Show conflict resolution prompt
        setPreviewData(data);
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
      setPreviewing(false);
    }
  }

  function handleCancelImport() {
    setPreviewData(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function formatImportResult(r: ImportResult): string {
    const parts: string[] = [];
    if (r.imported > 0) parts.push(`${r.imported} added`);
    if (r.updated > 0) parts.push(`${r.updated} updated`);
    if (r.skipped > 0) parts.push(`${r.skipped} skipped`);
    if (r.errors > 0) parts.push(`${r.errors} error${r.errors > 1 ? "s" : ""}`);
    return parts.length ? parts.join(", ") + "." : "Nothing to import.";
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

  const isBusy = previewing || importing;

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
          Import from a CSV exported by this app. New entries will be added automatically; you
          choose what to do with any existing ones.
        </p>
        <form onSubmit={handleImport} className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            disabled={isBusy}
            className="text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-slate-800 file:text-white hover:file:bg-slate-700 file:cursor-pointer"
          />
          <button
            type="submit"
            disabled={isBusy}
            className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
          >
            {previewing ? "Validating…" : importing ? "Importing…" : "Import"}
          </button>
        </form>

        {/* Conflict resolution prompt */}
        {previewData && !importing && (
          <div className="mt-3 rounded-lg bg-slate-800 border border-slate-700 p-4 space-y-3">
            <p className="text-sm text-slate-300">
              Found{" "}
              <span className="text-white font-medium">{previewData.newCount} new</span>{" "}
              {previewData.newCount === 1 ? "entry" : "entries"} and{" "}
              <span className="text-yellow-400 font-medium">
                {previewData.existingCount} already in your library
              </span>
              {previewData.invalidCount > 0 && (
                <span className="text-slate-500">
                  {" "}
                  ({previewData.invalidCount} row{previewData.invalidCount > 1 ? "s" : ""} skipped
                  due to invalid data)
                </span>
              )}
              . What should happen to the existing entries?
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => pendingFile && doImport(pendingFile, "update")}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Update existing
              </button>
              <button
                onClick={() => pendingFile && doImport(pendingFile, "skip")}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              >
                Skip existing
              </button>
              <button
                onClick={handleCancelImport}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-500 hover:text-slate-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {importResult && (
          <p className="text-xs text-green-400 mt-2">{formatImportResult(importResult)}</p>
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
