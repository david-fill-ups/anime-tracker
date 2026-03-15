"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { StreamingLink } from "@/app/generated/prisma";


type ServiceMeta = {
  name: string;
  bg: string;
  text: string;
  label: string;
};

const ANDROID_PACKAGES: Record<string, string> = {
  NETFLIX:      "com.netflix.mediaclient",
  HULU:         "com.hulu.plus",
  DISNEY_PLUS:  "com.disney.disneyplus",
  HBO:          "com.wbd.stream",
  CRUNCHYROLL:  "com.crunchyroll.crunchyroid",
  AMAZON_PRIME: "com.amazon.avod.thirdpartyclient",
  HIDIVE:       "com.hidive.hidiveapp",
};

function buildIntentUrl(webUrl: string, androidPackage: string): string {
  const u = new URL(webUrl);
  const host = u.host + u.pathname + u.search;
  const fallback = encodeURIComponent(webUrl);
  return `intent://${host}#Intent;scheme=https;package=${androidPackage};S.browser_fallback_url=${fallback};end`;
}

const SERVICE_ORDER: Record<string, number> = {
  CRUNCHYROLL: 0,
  NETFLIX: 1,
  HULU: 2,
};

function sortLinks(links: StreamingLink[]): StreamingLink[] {
  return [...links].sort((a, b) => {
    const ao = SERVICE_ORDER[a.service] ?? 99;
    const bo = SERVICE_ORDER[b.service] ?? 99;
    if (ao !== bo) return ao - bo;
    return a.service.localeCompare(b.service);
  });
}

const SERVICES: Record<string, ServiceMeta> = {
  NETFLIX: { name: "Netflix", bg: "#E50914", text: "#ffffff", label: "N" },
  HULU: { name: "Hulu", bg: "#1CE783", text: "#000000", label: "hulu" },
  DISNEY_PLUS: { name: "Disney+", bg: "#113CCF", text: "#ffffff", label: "D+" },
  HBO: { name: "HBO", bg: "#000000", text: "#ffffff", label: "HBO" },
  CRUNCHYROLL: { name: "Crunchyroll", bg: "#F47521", text: "#ffffff", label: "CR" },
  AMAZON_PRIME: { name: "Prime Video", bg: "#00A8E0", text: "#ffffff", label: "prime" },
  HIDIVE: { name: "HiDive", bg: "#00B9E3", text: "#ffffff", label: "HD" },
};

function ServiceIcon({ service }: { service: string }) {
  const meta = SERVICES[service];
  if (!meta) return null;
  return (
    <span
      className="inline-flex items-center justify-center rounded font-bold text-xs px-2 py-1 select-none"
      style={{ backgroundColor: meta.bg, color: meta.text, minWidth: "2.5rem" }}
    >
      {meta.label}
    </span>
  );
}


type Props = {
  animeId: number;
  initialLinks: StreamingLink[];
};

export default function WhereToWatch({ animeId, initialLinks }: Props) {
  const router = useRouter();
  const [links, setLinks] = useState<StreamingLink[]>(() => sortLinks(initialLinks));

  useEffect(() => {
    setLinks(sortLinks(initialLinks));
  }, [initialLinks]);

  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");
  }, []);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ service: "", url: "" });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const usedServices = new Set(links.map((l) => l.service));
  const availableServices = Object.keys(SERVICES).filter((s) => !usedServices.has(s as never));

  async function addLink() {
    if (!form.service || !form.url.trim()) {
      setError("Select a service and enter a URL.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/anime/${animeId}/streaming`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: form.service, url: form.url.trim() }),
    });
    if (res.ok) {
      const newLink: StreamingLink = await res.json();
      setLinks((prev) => sortLinks([...prev, newLink]));
      setForm({ service: "", url: "" });
      setAdding(false);
      router.refresh();
    } else {
      setError("Failed to save.");
    }
    setSaving(false);
  }

  async function removeLink(id: number) {
    setRemoving(id);
    await fetch(`/api/streaming/${id}`, { method: "DELETE" });
    setLinks((prev) => prev.filter((l) => l.id !== id));
    setRemoving(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Where to Watch</h3>
        <div className="flex items-center gap-3">
          {!adding && availableServices.length > 0 && (
            <button
              onClick={() => { setAdding(true); setError(""); setForm({ service: availableServices[0], url: "" }); }}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              + Add
            </button>
          )}
        </div>
      </div>

      {links.length === 0 && !adding && (
        <p className="text-sm text-slate-500">No streaming links added yet.</p>
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {links.map((link) => {
            const meta = SERVICES[link.service];
            const pkg = platform === "android" ? ANDROID_PACKAGES[link.service] : undefined;
            const href = pkg ? buildIntentUrl(link.url, pkg) : link.url;
            const target = platform === "desktop" ? "_blank" : "_self";
            return (
              <div key={link.id} className="group relative">
                <a
                  href={href}
                  target={target}
                  rel="noopener noreferrer"
                  title={meta?.name ?? link.service}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 bg-slate-800 hover:bg-slate-750 transition-colors"
                >
                  <ServiceIcon service={link.service} />
                  <span className="text-sm text-slate-300">{meta?.name ?? link.service}</span>
                </a>
                <button
                  onClick={() => removeLink(link.id)}
                  disabled={removing === link.id}
                  title="Remove"
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-slate-600 hover:bg-red-700 text-slate-300 hover:text-white text-xs transition-colors"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-slate-700 bg-slate-800/50">
          <div className="flex gap-2">
            <select
              value={form.service}
              onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
              className="bg-slate-800 text-slate-300 border border-slate-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
            >
              {availableServices.map((s) => (
                <option key={s} value={s}>{SERVICES[s].name}</option>
              ))}
            </select>
            <input
              type="url"
              placeholder="https://..."
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addLink()}
              className="flex-1 bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={addLink}
              disabled={saving}
              className="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setAdding(false); setError(""); }}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
