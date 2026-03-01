/**
 * Bulk-links MANUAL anime entries to AniList by searching each title.
 * Takes the top search result and updates anilistId + all metadata fields.
 * Run from the project root: node scripts/link-anilist.mjs
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../dev.db");

const ANILIST_URL = "https://graphql.anilist.co";

const SEARCH_QUERY = `
  query SearchAnime($search: String!) {
    Page(page: 1, perPage: 5) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title { romaji english native }
        coverImage { large }
        description(asHtml: false)
        genres
        episodes
        duration
        status
        format
        source
        season
        seasonYear
        meanScore
        nextAiringEpisode { episode airingAt }
      }
    }
  }
`;

async function searchAniList(search) {
  const response = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { search } }),
  });
  if (response.status === 429) throw new Error("RATE_LIMIT");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.errors) throw new Error(data.errors[0]?.message ?? "GraphQL error");
  return data.data?.Page?.media ?? [];
}

function mapDisplayFormat(format) {
  return format === "MOVIE" ? "MOVIE" : "SERIES";
}

function mapSourceMaterial(source) {
  if (!source) return null;
  const map = {
    ORIGINAL: "ORIGINAL", MANGA: "MANGA", LIGHT_NOVEL: "LIGHT_NOVEL",
    NOVEL: "NOVEL", VISUAL_NOVEL: "VISUAL_NOVEL", VIDEO_GAME: "VIDEO_GAME",
  };
  return map[source] ?? "OTHER";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const db = new Database(dbPath);

  const anime = db
    .prepare("SELECT id, titleRomaji FROM Anime WHERE anilistId IS NULL ORDER BY id")
    .all();

  console.log(`Found ${anime.length} anime without AniList ID\n`);

  const updateStmt = db.prepare(`
    UPDATE Anime SET
      anilistId     = ?,
      source        = 'ANILIST',
      titleRomaji   = ?,
      titleEnglish  = ?,
      titleNative   = ?,
      coverImageUrl = ?,
      synopsis      = ?,
      genres        = ?,
      totalEpisodes = ?,
      durationMins  = ?,
      airingStatus  = ?,
      displayFormat = ?,
      sourceMaterial = ?,
      season        = ?,
      seasonYear    = ?,
      meanScore     = ?,
      nextAiringEp  = ?,
      nextAiringAt  = ?,
      lastSyncedAt  = ?
    WHERE id = ?
  `);

  let matched = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of anime) {
    try {
      const results = await searchAniList(entry.titleRomaji);

      if (results.length === 0) {
        console.log(`[SKIP]  ${entry.id.toString().padStart(3)} ${entry.titleRomaji} — no results`);
        skipped++;
        await sleep(700);
        continue;
      }

      const best = results[0];
      const nextAiringAt = best.nextAiringEpisode
        ? new Date(best.nextAiringEpisode.airingAt * 1000).toISOString()
        : null;

      try {
        updateStmt.run(
          best.id,
          best.title.romaji,
          best.title.english ?? null,
          best.title.native ?? null,
          best.coverImage.large,
          best.description ?? null,
          JSON.stringify(best.genres),
          best.episodes ?? null,
          best.duration ?? null,
          best.status,
          mapDisplayFormat(best.format),
          mapSourceMaterial(best.source),
          best.season ?? null,
          best.seasonYear ?? null,
          best.meanScore ?? null,
          best.nextAiringEpisode?.episode ?? null,
          nextAiringAt,
          new Date().toISOString(),
          entry.id
        );
        console.log(`[OK]    ${entry.id.toString().padStart(3)} ${entry.titleRomaji} → "${best.title.romaji}" (anilist:${best.id})`);
        matched++;
      } catch (dbErr) {
        if (dbErr.message.includes("UNIQUE constraint")) {
          // Another entry already claimed this anilistId
          console.log(`[DUP]   ${entry.id.toString().padStart(3)} ${entry.titleRomaji} → anilist:${best.id} already used, skipping`);
          skipped++;
        } else {
          throw dbErr;
        }
      }
    } catch (err) {
      if (err.message === "RATE_LIMIT") {
        console.log("  Rate limited — waiting 65 seconds...");
        await sleep(65000);
        // Retry this entry
        anime.splice(anime.indexOf(entry), 0, entry); // re-queue
        continue;
      }
      console.error(`[ERR]   ${entry.id.toString().padStart(3)} ${entry.titleRomaji}: ${err.message}`);
      errors++;
    }

    // AniList allows ~90 req/min → ~667ms between requests; use 750ms to be safe
    await sleep(750);
  }

  db.close();
  console.log(`\n--- Done ---`);
  console.log(`Matched: ${matched}  |  Skipped/no-result: ${skipped}  |  Errors: ${errors}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
