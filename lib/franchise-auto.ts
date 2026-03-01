import { db } from "./db";
import type { AniListAnime } from "./anilist";
import type { FranchiseEntryType } from "@/app/generated/prisma";

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

function computeOrder(seasonYear: number | null, season: string | null): number {
  if (!seasonYear) return 999999;
  return seasonYear * 100 + (SEASON_OFFSET[season ?? ""] ?? 0);
}

function getEntryType(format: AniListAnime["format"]): FranchiseEntryType {
  if (format === "MOVIE") return "MOVIE";
  if (format === "OVA" || format === "SPECIAL") return "OVA";
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

  // Find which of those related anime are already in our DB
  const relatedInDb = await db.anime.findMany({
    where: { anilistId: { in: relatedAnilistIds } },
    select: { id: true },
  });

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
    // No franchise yet — create one named after the current anime
    const franchise = await db.franchise.create({
      data: {
        name: anilistData.title.english ?? anilistData.title.romaji,
        userId,
      },
    });
    targetFranchiseId = franchise.id;
  } else if (franchiseIds.length === 1) {
    targetFranchiseId = franchiseIds[0];
  } else {
    // Multiple franchises — merge them all into the one with the lowest ID
    franchiseIds.sort((a, b) => a - b);
    targetFranchiseId = franchiseIds[0];
    const toMerge = franchiseIds.slice(1);

    for (const srcId of toMerge) {
      const srcEntries = await db.franchiseEntry.findMany({
        where: { franchiseId: srcId },
        include: { anime: { select: { seasonYear: true, season: true } } },
      });

      for (const entry of srcEntries) {
        const alreadyInTarget = await db.franchiseEntry.findFirst({
          where: { franchiseId: targetFranchiseId, animeId: entry.animeId },
        });
        if (!alreadyInTarget) {
          const baseOrder = computeOrder(entry.anime.seasonYear, entry.anime.season);
          const order = await findAvailableOrder(targetFranchiseId, baseOrder);
          await db.franchiseEntry.create({
            data: {
              franchiseId: targetFranchiseId,
              animeId: entry.animeId,
              order,
              entryType: entry.entryType,
            },
          });
        }
      }

      await db.franchise.delete({ where: { id: srcId } });
    }
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
