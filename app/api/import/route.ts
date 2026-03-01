import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { fetchAniListById, mapDisplayFormat, mapSourceMaterial } from "@/lib/anilist";
import type { WatchStatus } from "@/app/generated/prisma";

const VALID_STATUSES = new Set<string>([
  "WATCHING",
  "COMPLETED",
  "ON_HOLD",
  "DROPPED",
  "PLAN_TO_WATCH",
  "RECOMMENDED",
  "NOT_INTERESTED",
]);

// Minimal RFC 4180-compatible CSV parser
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuote = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuote = true;
        } else if (ch === ',') {
          cells.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length < 2) {
    return NextResponse.json({ error: "Empty or invalid CSV" }, { status: 400 });
  }

  // Validate header matches our export format
  const header = rows[0];
  if (header[0] !== "AniList ID" || header[1] !== "Title") {
    return NextResponse.json({ error: "Invalid CSV format — must be exported from this app" }, { status: 400 });
  }

  let imported = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows.slice(1)) {
    try {
      const anilistIdStr = row[0];
      const status = row[2];
      const currentEpStr = row[3];
      const scoreStr = row[5];
      const recommenderName = row[13];
      const startedStr = row[14];
      const completedStr = row[15];
      const notes = row[16];

      if (!anilistIdStr || !VALID_STATUSES.has(status)) {
        errors++;
        continue;
      }

      const anilistId = Number(anilistIdStr);
      if (!Number.isInteger(anilistId) || anilistId <= 0) {
        errors++;
        continue;
      }

      // Find or create the anime record
      let anime = await db.anime.findUnique({ where: { anilistId } });
      if (!anime) {
        const data = await fetchAniListById(anilistId);
        if (!data) {
          errors++;
          continue;
        }

        // Upsert studios before creating the anime
        const studioCreates: { studioId: number; isMainStudio: boolean }[] = [];
        for (const edge of data.studios.edges) {
          const studio = await db.studio.upsert({
            where: { anilistStudioId: edge.node.id },
            update: { name: edge.node.name },
            create: { name: edge.node.name, anilistStudioId: edge.node.id },
          });
          studioCreates.push({ studioId: studio.id, isMainStudio: edge.isMain });
        }

        anime = await db.anime.create({
          data: {
            anilistId: data.id,
            source: "ANILIST",
            titleRomaji: data.title.romaji,
            titleEnglish: data.title.english ?? null,
            titleNative: data.title.native ?? null,
            coverImageUrl: data.coverImage.large,
            synopsis: data.description ?? null,
            genres: JSON.stringify(data.genres),
            totalEpisodes: data.episodes ?? null,
            durationMins: data.duration ?? null,
            airingStatus: data.status,
            displayFormat: mapDisplayFormat(data.format),
            sourceMaterial: mapSourceMaterial(data.source),
            season: data.season ?? null,
            seasonYear: data.seasonYear ?? null,
            meanScore: data.meanScore ?? null,
            nextAiringEp: data.nextAiringEpisode?.episode ?? null,
            nextAiringAt: data.nextAiringEpisode
              ? new Date(data.nextAiringEpisode.airingAt * 1000)
              : null,
            lastSyncedAt: new Date(),
            animeStudios: { create: studioCreates },
          },
        });
      }

      // Find or create the recommender person
      let recommenderId: number | null = null;
      if (recommenderName) {
        const person = await db.person.upsert({
          where: { name_userId: { name: recommenderName, userId } },
          update: {},
          create: { name: recommenderName, userId },
        });
        recommenderId = person.id;
      }

      const entryData = {
        watchStatus: status as WatchStatus,
        currentEpisode: Number(currentEpStr) || 0,
        score: scoreStr ? Number(scoreStr) : null,
        notes: notes || null,
        recommenderId,
        startedAt: startedStr ? new Date(startedStr) : null,
        completedAt: completedStr ? new Date(completedStr) : null,
      };

      const existing = await db.userEntry.findUnique({
        where: { animeId_userId: { animeId: anime.id, userId } },
      });

      if (existing) {
        await db.userEntry.update({
          where: { animeId_userId: { animeId: anime.id, userId } },
          data: entryData,
        });
        updated++;
      } else {
        await db.userEntry.create({
          data: { animeId: anime.id, userId, ...entryData },
        });
        imported++;
      }
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ imported, updated, errors });
}
