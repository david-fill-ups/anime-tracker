import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { wrapHandler } from "@/lib/validation";
import { checkRateLimit, recordRateLimit } from "@/lib/rate-limit";
import { fetchAniListById, mapAniListToAnimeData, upsertStudios } from "@/lib/anilist";
import { parseCSV, validateHeader, EXPECTED_HEADERS } from "@/lib/csv";
import type { WatchStatus, StreamingService, FranchiseEntryType } from "@/app/generated/prisma";

const VALID_STATUSES = new Set<string>([
  "WATCHING",
  "COMPLETED",
  "DROPPED",
  "PLAN_TO_WATCH",
  "NOT_INTERESTED",
]);

const VALID_STREAMING_SERVICES = new Set<string>([
  "NETFLIX",
  "HULU",
  "DISNEY_PLUS",
  "HBO",
  "CRUNCHYROLL",
  "AMAZON_PRIME",
  "HIDIVE",
]);

const VALID_ENTRY_TYPES = new Set<string>(["MAIN", "SIDE_STORY", "MOVIE", "OVA"]);


// Fetch or create an anime by AniList ID (without linking)
async function fetchOrCreateAnime(anilistId: number, tmdbIdVal: number | null) {
  let anime = await db.anime.findUnique({ where: { anilistId } });
  if (!anime) {
    const data = await fetchAniListById(anilistId);
    if (!data) return null;

    anime = await db.anime.create({
      data: {
        ...mapAniListToAnimeData(data, { tmdbId: tmdbIdVal }),
        animeStudios: { create: await upsertStudios(data.studios.edges) },
      },
    });
  } else if (tmdbIdVal && !anime.tmdbId) {
    await db.anime.update({ where: { id: anime.id }, data: { tmdbId: tmdbIdVal } });
  }
  return anime;
}

export async function POST(req: NextRequest) {
  return wrapHandler(async () => {
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

      // Check which anime are already in this user's library (via LinkedAnime)
      const existingLinked =
        existingAnime.length > 0
          ? await db.linkedAnime.findMany({
              where: { animeId: { in: existingAnime.map((a) => a.id) }, link: { userId } },
              select: { animeId: true },
            })
          : [];

      const linkedAnimeIdSet = new Set(existingLinked.map((la) => la.animeId));
      const animeByAnilistId = new Map(existingAnime.map((a) => [a.anilistId!, a.id]));

      let existingCount = 0;
      let newCount = 0;
      for (const anilistId of validAnilistIds) {
        const animeId = animeByAnilistId.get(anilistId);
        if (animeId !== undefined && linkedAnimeIdSet.has(animeId)) {
          existingCount++;
        } else {
          newCount++;
        }
      }

      return NextResponse.json({ newCount, existingCount, invalidCount });
    }

    // ── Rate limit check (import only, not preview) ───────────────────────────
    const rateLimitKey = `import:${userId}`;
    const { limited, secsLeft } = checkRateLimit(rateLimitKey, 30_000);
    if (limited) {
      return NextResponse.json(
        { error: `Please wait ${secsLeft}s before importing again` },
        { status: 429 },
      );
    }
    recordRateLimit(rateLimitKey);

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
        const franchiseStr = row[8] ?? "";
        const recommenderName = row[13];
        const startedStr = row[14];
        const completedStr = row[15];
        const notes = row[16];
        const tmdbIdStr = row[17] ?? "";
        const linkedIdsStr = row[18] ?? "";
        const streamingStr = row[19] ?? "";

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

        const anime = await fetchOrCreateAnime(anilistId, tmdbIdVal);
        if (!anime) {
          errors++;
          continue;
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

        // Find existing Link for this anime
        const existingLink = await db.link.findFirst({
          where: { userId, linkedAnime: { some: { animeId: anime.id } } },
          select: { id: true, userEntry: { select: { id: true } } },
        });

        if (existingLink?.userEntry) {
          if (conflictMode === "skip") {
            skipped++;
          } else {
            await db.userEntry.update({
              where: { linkId: existingLink.id },
              data: entryData,
            });
            updated++;
          }
        } else if (existingLink) {
          // Link exists but no UserEntry — create one
          await db.userEntry.create({
            data: { linkId: existingLink.id, userId, ...entryData },
          });
          imported++;
        } else {
          // No link — create Link + LinkedAnime + UserEntry
          await db.link.create({
            data: {
              userId,
              linkedAnime: { create: { animeId: anime.id, order: 0 } },
              userEntry: { create: { userId, ...entryData } },
            },
          });
          imported++;
        }

        // Re-establish linked anime for any linked AniList IDs
        if (linkedIdsStr) {
          // Find or create the link for the primary anime
          const link = await db.link.findFirst({
            where: { userId, linkedAnime: { some: { animeId: anime.id } } },
            include: { linkedAnime: { select: { animeId: true, order: true } } },
          });
          if (!link) continue;

          const linkedIds = linkedIdsStr
            .split(";")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isInteger(n) && n > 0);

          for (const linkedId of linkedIds) {
            try {
              const linkedAnime = await fetchOrCreateAnime(linkedId, null);
              if (!linkedAnime) continue;

              // Skip if already in this link
              if (link.linkedAnime.some((la) => la.animeId === linkedAnime.id)) continue;

              const nextOrder = link.linkedAnime.length;
              await db.linkedAnime.create({
                data: { linkId: link.id, animeId: linkedAnime.id, order: nextOrder },
              });
              // Update local array to track order
              link.linkedAnime.push({ animeId: linkedAnime.id, order: nextOrder });
            } catch {
              // skip individual link failures — don't fail the whole row
            }
          }
        }
        // ── Restore franchise associations ────────────────────────────────
        if (franchiseStr) {
          const franchiseEntries = franchiseStr.split(";").map((s) => s.trim()).filter(Boolean);
          for (const entry of franchiseEntries) {
            try {
              const parts = entry.split("|");
              if (parts.length !== 3) continue; // old format or malformed — skip
              const [franchiseName, orderStr, entryTypeStr] = parts;
              const order = Number(orderStr);
              if (!franchiseName?.trim() || !Number.isInteger(order) || order < 0) continue;
              const entryType = entryTypeStr?.trim();
              if (!VALID_ENTRY_TYPES.has(entryType)) continue;

              const franchise = await db.franchise.upsert({
                where: { name_userId: { name: franchiseName.trim(), userId } },
                update: {},
                create: { name: franchiseName.trim(), userId },
              });

              await db.franchiseEntry.upsert({
                where: { franchiseId_animeId: { franchiseId: franchise.id, animeId: anime.id } },
                update: { order, entryType: entryType as FranchiseEntryType },
                create: { franchiseId: franchise.id, animeId: anime.id, order, entryType: entryType as FranchiseEntryType },
              });
            } catch {
              // skip individual franchise entry failures (e.g. order conflicts)
            }
          }
        }

        // ── Restore streaming links ───────────────────────────────────────
        if (streamingStr) {
          const streamingEntries = streamingStr.split(";").map((s) => s.trim()).filter(Boolean);
          for (const entry of streamingEntries) {
            try {
              const colonIdx = entry.indexOf(":");
              if (colonIdx < 0) continue;
              const service = entry.slice(0, colonIdx).trim();
              const url = entry.slice(colonIdx + 1).trim();
              if (!VALID_STREAMING_SERVICES.has(service) || !url) continue;

              await db.streamingLink.upsert({
                where: { animeId_service: { animeId: anime.id, service: service as StreamingService } },
                update: { url },
                create: { animeId: anime.id, service: service as StreamingService, url },
              });
            } catch {
              // skip individual streaming link failures
            }
          }
        }
      } catch (err) {
        console.error("[import] Failed to process row:", err);
        errors++;
      }
    }

    return NextResponse.json({ imported, updated, skipped, errors });
  });
}
