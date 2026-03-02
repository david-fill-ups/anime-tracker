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

const EXPECTED_HEADERS = [
  "AniList ID",
  "Title",
  "Status",
  "Current Episode",
  "Total Episodes",
  "Score",
  "Community Score",
  "Format",
  "Franchise",
  "Main Studio",
  "Genres",
  "Airing Status",
  "Season",
  "Recommended By",
  "Started",
  "Completed",
  "Notes",
  "TMDB ID",
  "Linked AniList IDs",
];

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

function validateHeader(header: string[]): string | null {
  if (header.length < EXPECTED_HEADERS.length) {
    return `Invalid CSV format — expected ${EXPECTED_HEADERS.length} columns but found ${header.length}. Make sure this file was exported from this app.`;
  }
  // Check key columns by position
  const keyIndices = [0, 1, 2, 3, 5, 13, 14, 15, 16];
  for (const i of keyIndices) {
    if (header[i]?.trim() !== EXPECTED_HEADERS[i]) {
      return `Invalid CSV format — column ${i + 1} should be "${EXPECTED_HEADERS[i]}" but found "${header[i] ?? ""}". Make sure this file was exported from this app.`;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const mode = (formData.get("mode") as string) ?? "import";
  const conflictMode = (formData.get("conflictMode") as string) ?? "update";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json(
      { error: "Invalid file type — please upload a .csv file exported from this app" },
      { status: 400 },
    );
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
  }

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length < 2) {
    return NextResponse.json(
      { error: "The CSV file is empty or contains no data rows" },
      { status: 400 },
    );
  }

  const header = rows[0];
  const headerError = validateHeader(header);
  if (headerError) {
    return NextResponse.json({ error: headerError }, { status: 400 });
  }

  // ── Preview mode: validate format and count conflicts without writing ────────
  if (mode === "preview") {
    const validAnilistIds: number[] = [];
    let invalidCount = 0;

    for (const row of rows.slice(1)) {
      const anilistIdStr = row[0];
      const status = row[2];
      if (!anilistIdStr || !VALID_STATUSES.has(status)) {
        invalidCount++;
        continue;
      }
      const anilistId = Number(anilistIdStr);
      if (!Number.isInteger(anilistId) || anilistId <= 0) {
        invalidCount++;
        continue;
      }
      validAnilistIds.push(anilistId);
    }

    const existingAnime = await db.anime.findMany({
      where: { anilistId: { in: validAnilistIds } },
      select: { id: true, anilistId: true },
    });

    const existingEntries =
      existingAnime.length > 0
        ? await db.userEntry.findMany({
            where: { animeId: { in: existingAnime.map((a) => a.id) }, userId },
            select: { animeId: true },
          })
        : [];

    const entryAnimeIdSet = new Set(existingEntries.map((e) => e.animeId));
    const animeByAnilistId = new Map(existingAnime.map((a) => [a.anilistId!, a.id]));

    let existingCount = 0;
    let newCount = 0;
    for (const anilistId of validAnilistIds) {
      const animeId = animeByAnilistId.get(anilistId);
      if (animeId !== undefined && entryAnimeIdSet.has(animeId)) {
        existingCount++;
      } else {
        newCount++;
      }
    }

    return NextResponse.json({ newCount, existingCount, invalidCount });
  }

  // ── Import mode ──────────────────────────────────────────────────────────────
  let imported = 0;
  let updated = 0;
  let skipped = 0;
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
      const tmdbIdStr = row[17] ?? "";
      const linkedIdsStr = row[18] ?? "";

      if (!anilistIdStr || !VALID_STATUSES.has(status)) {
        errors++;
        continue;
      }

      const anilistId = Number(anilistIdStr);
      if (!Number.isInteger(anilistId) || anilistId <= 0) {
        errors++;
        continue;
      }

      const tmdbIdVal = tmdbIdStr ? Number(tmdbIdStr) : null;

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
            tmdbId: tmdbIdVal,
            animeStudios: { create: studioCreates },
          },
        });
      } else if (tmdbIdVal && !anime.tmdbId) {
        await db.anime.update({ where: { id: anime.id }, data: { tmdbId: tmdbIdVal } });
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
        if (conflictMode === "skip") {
          skipped++;
        } else {
          await db.userEntry.update({
            where: { animeId_userId: { animeId: anime.id, userId } },
            data: entryData,
          });
          updated++;
        }
      } else {
        await db.userEntry.create({
          data: { animeId: anime.id, userId, ...entryData },
        });
        imported++;
      }

      // Re-establish merge links for any linked AniList IDs
      if (linkedIdsStr) {
        const linkedIds = linkedIdsStr
          .split(";")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n) && n > 0);

        for (const linkedId of linkedIds) {
          try {
            let linked = await db.anime.findUnique({ where: { anilistId: linkedId } });
            if (!linked) {
              const data = await fetchAniListById(linkedId);
              if (!data) continue;
              const studioCreates: { studioId: number; isMainStudio: boolean }[] = [];
              for (const edge of data.studios.edges) {
                const studio = await db.studio.upsert({
                  where: { anilistStudioId: edge.node.id },
                  update: { name: edge.node.name },
                  create: { name: edge.node.name, anilistStudioId: edge.node.id },
                });
                studioCreates.push({ studioId: studio.id, isMainStudio: edge.isMain });
              }
              linked = await db.anime.create({
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
                  mergedIntoId: anime.id,
                  animeStudios: { create: studioCreates },
                },
              });
            } else if (!linked.mergedIntoId) {
              await db.anime.update({
                where: { id: linked.id },
                data: { mergedIntoId: anime.id },
              });
            }
          } catch {
            // skip individual link failures — don't fail the whole row
          }
        }
      }
    } catch (err) {
      console.error("[import] Failed to process row:", err);
      errors++;
    }
  }

  return NextResponse.json({ imported, updated, skipped, errors });
}
