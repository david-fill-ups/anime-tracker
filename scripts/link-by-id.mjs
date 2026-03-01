/**
 * Link specific anime entries to AniList by providing the exact AniList ID.
 * Fetches full metadata and updates the DB.
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../dev.db");

const ANILIST_URL = "https://graphql.anilist.co";

const FETCH_QUERY = `
  query FetchAnime($id: Int!) {
    Media(id: $id, type: ANIME) {
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
`;

async function fetchById(id) {
  const r = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: FETCH_QUERY, variables: { id } }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (d.errors) throw new Error(d.errors[0]?.message);
  return d.data?.Media ?? null;
}

function mapDisplayFormat(f) { return f === "MOVIE" ? "MOVIE" : "SERIES"; }
function mapSourceMaterial(s) {
  if (!s) return null;
  return { ORIGINAL:"ORIGINAL", MANGA:"MANGA", LIGHT_NOVEL:"LIGHT_NOVEL", NOVEL:"NOVEL", VISUAL_NOVEL:"VISUAL_NOVEL", VIDEO_GAME:"VIDEO_GAME" }[s] ?? "OTHER";
}

// dbId → anilistId mapping (manually confirmed)
const MAPPINGS = [
  { dbId: 96,  anilistId: 20966  },  // Yamada-kun and the Seven Witches
  { dbId: 129, anilistId: 21428  },  // Grimgar: Ashes and Illusions
  { dbId: 145, anilistId: 179885 },  // Scooped Up by an S-Ranked Adventurer
  { dbId: 165, anilistId: 187264 },  // Jack of All Trades, Master of None
];

async function main() {
  const db = new Database(dbPath);
  const updateStmt = db.prepare(`
    UPDATE Anime SET
      anilistId = ?, source = 'ANILIST',
      titleRomaji = ?, titleEnglish = ?, titleNative = ?,
      coverImageUrl = ?, synopsis = ?, genres = ?,
      totalEpisodes = ?, durationMins = ?,
      airingStatus = ?, displayFormat = ?, sourceMaterial = ?,
      season = ?, seasonYear = ?, meanScore = ?,
      nextAiringEp = ?, nextAiringAt = ?, lastSyncedAt = ?
    WHERE id = ?
  `);

  for (const { dbId, anilistId } of MAPPINGS) {
    try {
      const data = await fetchById(anilistId);
      if (!data) { console.log(`[SKIP] db:${dbId} — AniList ${anilistId} not found`); continue; }

      const nextAiringAt = data.nextAiringEpisode
        ? new Date(data.nextAiringEpisode.airingAt * 1000).toISOString() : null;

      updateStmt.run(
        data.id,
        data.title.romaji, data.title.english ?? null, data.title.native ?? null,
        data.coverImage.large, data.description ?? null, JSON.stringify(data.genres),
        data.episodes ?? null, data.duration ?? null,
        data.status, mapDisplayFormat(data.format), mapSourceMaterial(data.source),
        data.season ?? null, data.seasonYear ?? null, data.meanScore ?? null,
        data.nextAiringEpisode?.episode ?? null, nextAiringAt,
        new Date().toISOString(),
        dbId
      );
      console.log(`[OK] db:${dbId} → "${data.title.romaji}" (anilist:${data.id})`);
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.error(`[ERR] db:${dbId}:`, err.message);
    }
  }

  db.close();
  console.log("\nDone.");
}
main().catch(console.error);
