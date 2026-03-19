import { db } from "./db";
import { fetchAniListById, mapAniListToAnimeData } from "./anilist";
import type { AniListAnime } from "./anilist";
import type { FranchiseEntryType, DisplayFormat } from "@/app/generated/prisma";

// Relation types that indicate "same franchise"
const FRANCHISE_RELATION_TYPES = new Set([
  "PREQUEL",
  "SEQUEL",
  "PARENT",
  "SIDE_STORY",
  "SPIN_OFF",
  "ALTERNATIVE",
  "COMPILATION",
  "CONTAINS",
]);

const SEASON_OFFSET: Record<string, number> = {
  WINTER: 0,
  SPRING: 3,
  SUMMER: 6,
  FALL: 9,
};

export function computeOrder(seasonYear: number | null, season: string | null): number {
  if (!seasonYear) return 999999;
  return seasonYear * 100 + (SEASON_OFFSET[season ?? ""] ?? 0);
}

export function getEntryType(format: AniListAnime["format"]): FranchiseEntryType {
  if (format === "MOVIE") return "MOVIE";
  if (format === "OVA" || format === "SPECIAL") return "OVA";
  return "MAIN";
}

export function entryTypeFromDisplayFormat(displayFormat: DisplayFormat): FranchiseEntryType {
  if (displayFormat === "MOVIE") return "MOVIE";
  return "MAIN";
}

async function findAvailableOrder(franchiseId: number, baseOrder: number): Promise<number> {
  const used = await db.franchiseEntry.findMany({
    where: { franchiseId },
    select: { order: true },
  });
  const usedSet = new Set(used.map((e) => e.order));
  let order = baseOrder;
  while (usedSet.has(order)) order++;
  return order;
}

// Create a bare Anime record from AniList data (no Link, no UserEntry).
// Returns the DB id + fields needed for franchise ordering, or null on failure.
async function ensureAnimeInDb(anilistData: AniListAnime) {
  const existing = await db.anime.findUnique({ where: { anilistId: anilistData.id } });
  if (existing) return existing;

  try {
    return await db.anime.create({
      data: mapAniListToAnimeData(anilistData),
    });
  } catch {
    // Race condition — another request may have created it; try again
    return db.anime.findUnique({ where: { anilistId: anilistData.id } });
  }
}

async function renameFranchiseToEarliest(franchiseId: number): Promise<void> {
  const entries = await db.franchiseEntry.findMany({
    where: { franchiseId },
    orderBy: { order: "asc" },
    include: { anime: { select: { titleEnglish: true, titleRomaji: true } } },
    take: 1,
  });
  if (entries.length === 0) return;

  const root = entries[0].anime;
  const name = root.titleEnglish ?? root.titleRomaji;

  try {
    await db.franchise.update({ where: { id: franchiseId }, data: { name } });
  } catch {
    // Name already taken by another franchise for this user — skip rename
  }
}

export async function autoPopulateFranchise(
  animeId: number,
  anilistData: AniListAnime,
  userId: string
): Promise<void> {
  // Get AniList IDs of franchise-relevant related anime
  const relatedAnilistIds = anilistData.relations.edges
    .filter(
      (e) =>
        e.node.type === "ANIME" && FRANCHISE_RELATION_TYPES.has(e.relationType)
    )
    .map((e) => e.node.id);

  if (relatedAnilistIds.length === 0) return;

  // Find related anime already in our global DB (not restricted to user's library)
  const relatedInDb = await db.anime.findMany({
    where: { anilistId: { in: relatedAnilistIds } },
    select: { id: true, anilistId: true, seasonYear: true, season: true, displayFormat: true },
  });

  // For SEQUEL/PREQUEL relations not yet in the DB, fetch from AniList and create bare records.
  // This lets the recommendation system surface seasons the user doesn't know about yet.
  const relatedInDbAnilistIds = new Set(relatedInDb.map((a) => a.anilistId));
  const missingSequelIds = anilistData.relations.edges
    .filter(
      (e) =>
        e.node.type === "ANIME" &&
        (e.relationType === "SEQUEL" || e.relationType === "PREQUEL") &&
        !relatedInDbAnilistIds.has(e.node.id)
    )
    .map((e) => e.node.id);

  for (const sequelAnilistId of missingSequelIds) {
    try {
      const sequelData = await fetchAniListById(sequelAnilistId);
      if (!sequelData) continue;
      const record = await ensureAnimeInDb(sequelData);
      if (record) relatedInDb.push(record);
    } catch {
      // Don't fail franchise population if AniList is temporarily unavailable
    }
  }

  // No related anime anywhere — nothing to group
  if (relatedInDb.length === 0) return;

  const relatedIds = relatedInDb.map((a) => a.id);

  // Find all franchise entries for the related anime AND the current anime,
  // scoped to this user's franchises
  const existingEntries = await db.franchiseEntry.findMany({
    where: {
      animeId: { in: [animeId, ...relatedIds] },
      franchise: { userId },
    },
    select: { franchiseId: true, animeId: true },
  });

  const franchiseIds = [...new Set(existingEntries.map((e) => e.franchiseId))];

  let targetFranchiseId: number;

  if (franchiseIds.length === 0) {
    // No franchise yet — create one and add all related library anime
    const franchise = await db.franchise.create({
      data: {
        name: anilistData.title.english ?? anilistData.title.romaji,
        userId,
      },
    });
    targetFranchiseId = franchise.id;

    // Add all related library anime to the new franchise
    for (const relatedAnime of relatedInDb) {
      const baseOrder = computeOrder(relatedAnime.seasonYear, relatedAnime.season);
      const order = await findAvailableOrder(targetFranchiseId, baseOrder);
      await db.franchiseEntry.create({
        data: {
          franchiseId: targetFranchiseId,
          animeId: relatedAnime.id,
          order,
          entryType: entryTypeFromDisplayFormat(relatedAnime.displayFormat),
        },
      });
    }
  } else if (franchiseIds.length === 1) {
    targetFranchiseId = franchiseIds[0];

    // Also add any related library anime not yet in this franchise
    for (const relatedAnime of relatedInDb) {
      const alreadyIn = existingEntries.some(
        (e) => e.franchiseId === targetFranchiseId && e.animeId === relatedAnime.id
      );
      if (!alreadyIn) {
        const baseOrder = computeOrder(relatedAnime.seasonYear, relatedAnime.season);
        const order = await findAvailableOrder(targetFranchiseId, baseOrder);
        await db.franchiseEntry.upsert({
          where: {
            franchiseId_animeId: {
              franchiseId: targetFranchiseId,
              animeId: relatedAnime.id,
            },
          },
          create: {
            franchiseId: targetFranchiseId,
            animeId: relatedAnime.id,
            order,
            entryType: entryTypeFromDisplayFormat(relatedAnime.displayFormat),
          },
          update: {},
        });
      }
    }
  } else {
    // Multiple franchises — merge them all into the one with the lowest ID
    franchiseIds.sort((a, b) => a - b);
    targetFranchiseId = franchiseIds[0];
    const toMerge = franchiseIds.slice(1);

    await db.$transaction(async (tx) => {
      for (const srcId of toMerge) {
        const srcEntries = await tx.franchiseEntry.findMany({
          where: { franchiseId: srcId },
          include: { anime: { select: { seasonYear: true, season: true } } },
        });

        for (const entry of srcEntries) {
          const alreadyInTarget = await tx.franchiseEntry.findFirst({
            where: { franchiseId: targetFranchiseId, animeId: entry.animeId },
          });
          if (!alreadyInTarget) {
            const baseOrder = computeOrder(entry.anime.seasonYear, entry.anime.season);
            const order = await findAvailableOrder(targetFranchiseId, baseOrder);
            await tx.franchiseEntry.create({
              data: {
                franchiseId: targetFranchiseId,
                animeId: entry.animeId,
                order,
                entryType: entry.entryType,
              },
            });
          }
        }

        await tx.franchise.delete({ where: { id: srcId } });
      }
    });
  }

  // Add current anime to the target franchise if not already there
  const alreadyInFranchise = await db.franchiseEntry.findFirst({
    where: { franchiseId: targetFranchiseId, animeId },
  });

  if (!alreadyInFranchise) {
    const baseOrder = computeOrder(anilistData.seasonYear, anilistData.season);
    const order = await findAvailableOrder(targetFranchiseId, baseOrder);
    await db.franchiseEntry.create({
      data: {
        franchiseId: targetFranchiseId,
        animeId,
        order,
        entryType: getEntryType(anilistData.format),
      },
    });
  }

  await renameFranchiseToEarliest(targetFranchiseId);
}
