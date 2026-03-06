/**
 * Backfill franchise relationships for existing library entries.
 *
 * For each anime in the library:
 *   1. If it has an anilistId → fetch AniList relations, add missing related anime to DB, run franchise populate
 *   2. If no anilistId → search AniList by title, link if confident match found, then do step 1
 *
 * Run: npx tsx scripts/backfill-franchises.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { GraphQLClient } from "graphql-request";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter } as any);
const anilist = new GraphQLClient("https://graphql.anilist.co");

// ── AniList types & queries ──────────────────────────────────────────────────

interface AniListAnime {
  id: number;
  title: { romaji: string; english: string | null; native: string | null };
  coverImage: { large: string };
  description: string | null;
  genres: string[];
  episodes: number | null;
  duration: number | null;
  status: "FINISHED" | "RELEASING" | "NOT_YET_RELEASED" | "CANCELLED" | "HIATUS";
  format: "TV" | "TV_SHORT" | "MOVIE" | "SPECIAL" | "OVA" | "ONA" | "MUSIC";
  source: string | null;
  season: "WINTER" | "SPRING" | "SUMMER" | "FALL" | null;
  seasonYear: number | null;
  meanScore: number | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
  studios: { edges: { isMain: boolean; node: { id: number; name: string } }[] };
  relations: { edges: { relationType: string; node: { id: number; type: string; title: { romaji: string; english: string | null } } }[] };
}

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { large }
  description(asHtml: false)
  genres episodes duration status format source season seasonYear meanScore
  nextAiringEpisode { episode airingAt }
  studios { edges { isMain node { id name } } }
  relations { edges { relationType(version: 2) node { id type title { romaji english } } } }
`;

const SEARCH_QUERY = `query($search: String!) { Page(perPage: 5) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} } } }`;

// Batch fetch up to 10 anime at once using GraphQL aliases, with 429 retry
async function fetchByIds(ids: number[]): Promise<Map<number, AniListAnime>> {
  const BATCH = 10;
  const result = new Map<number, AniListAnime>();
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const aliases = chunk.map(id => `a${id}: Media(id: ${id}, type: ANIME) { ${MEDIA_FIELDS} }`).join("\n");
    const query = `query { ${aliases} }`;
    let attempts = 0;
    while (attempts < 5) {
      try {
        const data = await anilist.request<Record<string, AniListAnime>>(query);
        for (const id of chunk) {
          const item = data[`a${id}`];
          if (item) result.set(id, item);
        }
        break;
      } catch (e: any) {
        const is429 = e?.response?.status === 429 || String(e).includes("Too Many Requests");
        if (is429) {
          attempts++;
          const wait = 65000; // wait 65s for rate limit window to reset
          console.log(`  Rate limited — waiting ${wait/1000}s before retry (attempt ${attempts}/5)...`);
          await sleep(wait);
        } else {
          console.error(`  Batch fetch error (ids ${chunk[0]}-${chunk[chunk.length-1]}): ${e?.message ?? String(e)}`);
          break;
        }
      }
    }
    if (i + BATCH < ids.length) await sleep(800); // ~75 reqs/min max with batch of 10
  }
  return result;
}

async function searchAniList(title: string): Promise<AniListAnime[]> {
  try {
    const data = await anilist.request<{ Page: { media: AniListAnime[] } }>(SEARCH_QUERY, { search: title });
    return data.Page.media ?? [];
  } catch { return []; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Franchise logic (mirrors lib/franchise-auto.ts) ─────────────────────────

const FRANCHISE_RELATION_TYPES = new Set(["PREQUEL","SEQUEL","PARENT","SIDE_STORY","SPIN_OFF","ALTERNATIVE","COMPILATION","CONTAINS"]);
const SEASON_OFFSET: Record<string, number> = { WINTER: 0, SPRING: 3, SUMMER: 6, FALL: 9 };

function computeOrder(seasonYear: number | null, season: string | null): number {
  if (!seasonYear) return 999999;
  return seasonYear * 100 + (SEASON_OFFSET[season ?? ""] ?? 0);
}

function getEntryType(format: AniListAnime["format"]): "MOVIE" | "OVA" | "MAIN" {
  if (format === "MOVIE") return "MOVIE";
  if (format === "OVA" || format === "SPECIAL") return "OVA";
  return "MAIN";
}

function mapDisplayFormat(format: AniListAnime["format"]): "SERIES" | "MOVIE" {
  return format === "MOVIE" ? "MOVIE" : "SERIES";
}

function mapSourceMaterial(source: string | null): string | null {
  if (!source) return null;
  const map: Record<string, string> = { ORIGINAL:"ORIGINAL", MANGA:"MANGA", LIGHT_NOVEL:"LIGHT_NOVEL", NOVEL:"NOVEL", VISUAL_NOVEL:"VISUAL_NOVEL", VIDEO_GAME:"VIDEO_GAME" };
  return map[source] ?? "OTHER";
}

async function findAvailableOrder(franchiseId: number, baseOrder: number): Promise<number> {
  const used = await db.franchiseEntry.findMany({ where: { franchiseId }, select: { order: true } });
  const usedSet = new Set(used.map((e: { order: number }) => e.order));
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
  const root = entries[0].anime as { titleEnglish: string | null; titleRomaji: string };
  const name = root.titleEnglish ?? root.titleRomaji;
  try {
    await db.franchise.update({ where: { id: franchiseId }, data: { name } });
  } catch { /* name collision — skip */ }
}

async function autoPopulateFranchise(animeId: number, data: AniListAnime, userId: string): Promise<void> {
  const relatedAnilistIds = data.relations.edges
    .filter(e => e.node.type === "ANIME" && FRANCHISE_RELATION_TYPES.has(e.relationType))
    .map(e => e.node.id);
  if (relatedAnilistIds.length === 0) return;

  const relatedInDb = await db.anime.findMany({ where: { anilistId: { in: relatedAnilistIds } }, select: { id: true } });
  if (relatedInDb.length === 0) return;
  const relatedIds = (relatedInDb as { id: number }[]).map(a => a.id);

  const existingEntries = await db.franchiseEntry.findMany({
    where: { animeId: { in: [animeId, ...relatedIds] }, franchise: { userId } },
    select: { franchiseId: true, animeId: true },
  });

  const franchiseIds = [...new Set((existingEntries as { franchiseId: number }[]).map(e => e.franchiseId))];

  let targetFranchiseId: number;
  if (franchiseIds.length === 0) {
    const franchise = await db.franchise.create({ data: { name: data.title.english ?? data.title.romaji, userId } });
    targetFranchiseId = franchise.id;
  } else if (franchiseIds.length === 1) {
    targetFranchiseId = franchiseIds[0];
  } else {
    franchiseIds.sort((a, b) => a - b);
    targetFranchiseId = franchiseIds[0];
    for (const srcId of franchiseIds.slice(1)) {
      const srcEntries = await db.franchiseEntry.findMany({ where: { franchiseId: srcId }, include: { anime: { select: { seasonYear: true, season: true } } } });
      for (const entry of srcEntries as any[]) {
        const alreadyInTarget = await db.franchiseEntry.findFirst({ where: { franchiseId: targetFranchiseId, animeId: entry.animeId } });
        if (!alreadyInTarget) {
          const baseOrder = computeOrder(entry.anime.seasonYear, entry.anime.season);
          const order = await findAvailableOrder(targetFranchiseId, baseOrder);
          await db.franchiseEntry.create({ data: { franchiseId: targetFranchiseId, animeId: entry.animeId, order, entryType: entry.entryType } });
        }
      }
      await db.franchise.delete({ where: { id: srcId } });
    }
  }

  const alreadyInFranchise = await db.franchiseEntry.findFirst({ where: { franchiseId: targetFranchiseId, animeId } });
  if (!alreadyInFranchise) {
    const baseOrder = computeOrder(data.seasonYear, data.season);
    const order = await findAvailableOrder(targetFranchiseId, baseOrder);
    await db.franchiseEntry.create({ data: { franchiseId: targetFranchiseId, animeId, order, entryType: getEntryType(data.format) } });
  }

  await renameFranchiseToEarliest(targetFranchiseId);
}

// ── Ensure a related anime exists in the DB ──────────────────────────────────

async function ensureAnimeInDb(anilistData: AniListAnime): Promise<number | null> {
  const existing = await db.anime.findUnique({ where: { anilistId: anilistData.id } });
  if (existing) return existing.id;

  try {
    const created = await db.anime.create({
      data: {
        anilistId: anilistData.id,
        source: "ANILIST",
        titleRomaji: anilistData.title.romaji,
        titleEnglish: anilistData.title.english ?? null,
        titleNative: anilistData.title.native ?? null,
        coverImageUrl: anilistData.coverImage.large,
        synopsis: anilistData.description ?? null,
        genres: JSON.stringify(anilistData.genres),
        totalEpisodes: anilistData.episodes ?? null,
        durationMins: anilistData.duration ?? null,
        airingStatus: anilistData.status,
        displayFormat: mapDisplayFormat(anilistData.format),
        sourceMaterial: mapSourceMaterial(anilistData.source) as any,
        season: anilistData.season ?? null,
        seasonYear: anilistData.seasonYear ?? null,
        meanScore: anilistData.meanScore ?? null,
        nextAiringEp: anilistData.nextAiringEpisode?.episode ?? null,
        nextAiringAt: anilistData.nextAiringEpisode ? new Date(anilistData.nextAiringEpisode.airingAt * 1000) : null,
        lastSyncedAt: new Date(),
      },
    });
    return created.id;
  } catch {
    // Might have been created by a concurrent insert — try fetching again
    const retry = await db.anime.findUnique({ where: { anilistId: anilistData.id } });
    return retry?.id ?? null;
  }
}

// ── Title matching ───────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function titleMatch(dbTitle: string, anilistAnime: AniListAnime): boolean {
  const dbNorm = normalize(dbTitle);
  const candidates = [
    anilistAnime.title.english,
    anilistAnime.title.romaji,
    anilistAnime.title.native,
  ].filter(Boolean).map(t => normalize(t!));
  return candidates.some(c => c === dbNorm);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const users = await db.user.findMany({ select: { id: true, name: true, email: true } });
  console.log(`Found ${users.length} user(s)\n`);

  for (const user of users as { id: string; name: string | null; email: string | null }[]) {
    console.log(`\n=== Processing user: ${user.name ?? user.email ?? user.id} ===`);

    const libraryStatuses = ["WATCHING", "COMPLETED", "ON_HOLD", "DROPPED"];
    const entries = await db.userEntry.findMany({
      where: { userId: user.id, watchStatus: { in: libraryStatuses as any[] } },
      include: { anime: true },
    });

    console.log(`  Library entries: ${entries.length}`);

    const animes = (entries as any[]).map(e => e.anime);

    // Split into those with/without AniList IDs
    const withId = animes.filter(a => a.anilistId);
    const withoutId = animes.filter(a => !a.anilistId);
    console.log(`  With AniList ID: ${withId.length}, manual (no ID): ${withoutId.length}`);

    // Batch-fetch all known AniList IDs at once
    console.log("  Fetching AniList data in batches...");
    const anilistMap = await fetchByIds(withId.map((a: any) => a.anilistId));
    console.log(`  Fetched ${anilistMap.size}/${withId.length} successfully`);

    // For manual entries, search AniList by title one at a time
    let linked = 0, skipped = 0;
    for (const anime of withoutId) {
      const title = anime.titleEnglish ?? anime.titleRomaji;
      const results = await searchAniList(title);
      await sleep(1200);
      const match = results.find((r: AniListAnime) => titleMatch(title, r));
      if (match) {
        try {
          await db.anime.update({
            where: { id: anime.id },
            data: {
              anilistId: match.id, source: "ANILIST",
              titleRomaji: match.title.romaji, titleEnglish: match.title.english ?? null,
              titleNative: match.title.native ?? null, coverImageUrl: match.coverImage.large,
              synopsis: match.description ?? null, genres: JSON.stringify(match.genres),
              totalEpisodes: match.episodes ?? null, durationMins: match.duration ?? null,
              airingStatus: match.status, displayFormat: mapDisplayFormat(match.format),
              sourceMaterial: mapSourceMaterial(match.source) as any,
              season: match.season ?? null, seasonYear: match.seasonYear ?? null,
              meanScore: match.meanScore ?? null, lastSyncedAt: new Date(),
            },
          });
          anilistMap.set(match.id, match);
          anime.anilistId = match.id;
          linked++;
          console.log(`  [linked] "${title}" → AniList #${match.id} (${match.title.english ?? match.title.romaji})`);
        } catch (e: any) {
          if (e?.code === "P2002") {
            console.log(`  [skip]   "${title}" — AniList #${match.id} already claimed by another record`);
          } else throw e;
          skipped++;
        }
      } else {
        skipped++;
        console.log(`  [skip]   "${title}" — no confident AniList match`);
      }
    }

    // Now process all anime that have AniList data
    // First collect all related IDs we'll need to fetch
    const relatedIdsNeeded = new Set<number>();
    for (const anime of animes) {
      const data = anilistMap.get(anime.anilistId);
      if (!data) continue;
      for (const e of data.relations.edges) {
        if (e.node.type === "ANIME" && FRANCHISE_RELATION_TYPES.has(e.relationType)) {
          relatedIdsNeeded.add(e.node.id);
        }
      }
    }
    // Remove IDs already in DB
    const alreadyInDb = await db.anime.findMany({ where: { anilistId: { in: [...relatedIdsNeeded] } }, select: { anilistId: true } });
    const alreadyInDbSet = new Set((alreadyInDb as any[]).map((a: any) => a.anilistId));
    const missingRelatedIds = [...relatedIdsNeeded].filter(id => !alreadyInDbSet.has(id));

    if (missingRelatedIds.length > 0) {
      console.log(`  Fetching ${missingRelatedIds.length} related anime not yet in DB...`);
      const relatedData = await fetchByIds(missingRelatedIds);
      for (const [, data] of relatedData) {
        await ensureAnimeInDb(data);
      }
    }

    // Run franchise populate for each anime
    let franchised = 0;
    for (const anime of animes) {
      const data = anilistMap.get(anime.anilistId);
      if (!data) continue;
      await autoPopulateFranchise(anime.id, data, user.id);
      franchised++;
    }

    console.log(`\n  Summary for ${user.name ?? user.email}:`);
    console.log(`    Had AniList ID:      ${withId.length}`);
    console.log(`    Matched to AniList:  ${linked}`);
    console.log(`    Skipped (no match):  ${skipped}`);
    console.log(`    Franchise populate:  ${franchised}`);
  }

  // Print franchise summary
  const franchises = await db.franchise.findMany({
    include: { entries: { include: { anime: { select: { titleEnglish: true, titleRomaji: true } } } } },
  });
  console.log(`\n=== Franchises created/updated: ${franchises.length} ===`);
  for (const f of franchises as any[]) {
    const names = f.entries.map((e: any) => e.anime.titleEnglish ?? e.anime.titleRomaji).join(", ");
    console.log(`  ${f.name} (${f.entries.length} entries): ${names}`);
  }

  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
