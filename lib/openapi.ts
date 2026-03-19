/**
 * OpenAPI 3.1 spec builder.
 *
 * Request body schemas are generated directly from the Zod validation schemas
 * in lib/validation.ts using z.toJSONSchema() — so they update automatically
 * whenever the validation rules change.
 */

import { z } from "zod";
import {
  CreateAnimeSchema,
  UpdateAnimeSchema,
  CreateFranchiseSchema,
  UpdateFranchiseSchema,
  CreatePersonSchema,
  CreateStreamingLinkSchema,
  LinkAniListSchema,
  UpdateUserEntrySchema,
  AddAnimeToFranchiseSchema,
} from "./validation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

/** Convert a Zod schema to JSON Schema using Zod v4's built-in utility. */
function s(zodSchema: z.ZodType): AnyObj {
  return z.toJSONSchema(zodSchema) as AnyObj;
}

function pathParam(name: string, description: string) {
  return {
    name,
    in: "path" as const,
    required: true,
    description,
    schema: { type: "integer" },
  };
}

function queryParam(name: string, description: string, required = false) {
  return {
    name,
    in: "query" as const,
    required,
    description,
    schema: { type: "string" },
  };
}

function jsonBody(zodSchema: z.ZodType) {
  return {
    required: true,
    content: {
      "application/json": { schema: s(zodSchema) },
    },
  };
}

function resp(description: string) {
  return { description };
}

export function buildOpenApiSpec(): AnyObj {
  return {
    openapi: "3.1.0",
    info: {
      title: "Anime Tracker API",
      version: "1.0.0",
      description:
        "Internal REST API for Anime Tracker. All endpoints require an authenticated session unless noted.",
    },
    servers: [{ url: "/" }],
    tags: [
      {
        name: "Anime",
        description: "Anime catalog entries and user library management",
      },
      {
        name: "Links",
        description:
          "Link collections — each Link groups one or more related anime (e.g. seasons) under a single UserEntry",
      },
      {
        name: "Search",
        description:
          "Search your library or the external AniList catalog",
      },
      {
        name: "Franchises",
        description:
          "Custom franchise groupings that span multiple Links",
      },
      {
        name: "People",
        description:
          "People who recommend or watch anime with you",
      },
      {
        name: "Import/Export",
        description: "CSV data portability",
      },
      {
        name: "Streaming",
        description: "Streaming service links for anime",
      },
      {
        name: "Sync",
        description:
          "Synchronize metadata from AniList and TMDB",
      },
      {
        name: "Utilities",
        description: "Miscellaneous endpoints used by the UI",
      },
      { name: "Profile", description: "Account management" },
    ],
    paths: {
      // ─── Anime ────────────────────────────────────────────────────────────────

      "/api/anime": {
        get: {
          operationId: "listAnime",
          summary: "List library",
          description: "Returns all anime links in the user's library.",
          tags: ["Anime"],
          responses: {
            "200": resp("Array of links with anime and user entries"),
            "401": resp("Unauthorized"),
          },
        },
        post: {
          operationId: "createAnime",
          summary: "Add anime to library",
          description:
            "Adds an anime to the user's library. Use `source: 'ANILIST'` to import from AniList (metadata fetched automatically) or `source: 'MANUAL'` to enter metadata yourself.",
          tags: ["Anime"],
          requestBody: jsonBody(CreateAnimeSchema),
          responses: {
            "201": resp("Anime created and added to library"),
            "400": resp("Validation error"),
            "401": resp("Unauthorized"),
            "409": resp("Anime already in your library"),
          },
        },
      },

      "/api/anime/search": {
        get: {
          operationId: "searchLibrary",
          summary: "Search library",
          description:
            "Full-text search across the user's library by title. Returns up to 8 results. Requires at least 2 characters.",
          tags: ["Search"],
          parameters: [
            queryParam("q", "Search query (minimum 2 chars)", true),
            queryParam("excludeId", "Anime ID to exclude from results"),
            queryParam(
              "excludeLinkId",
              "Exclude anime already in this Link ID",
            ),
          ],
          responses: {
            "200": resp("Array of matching anime (max 8)"),
            "401": resp("Unauthorized"),
          },
        },
      },

      "/api/anime/{id}": {
        parameters: [pathParam("id", "Anime ID")],
        get: {
          operationId: "getAnime",
          summary: "Get anime details",
          description:
            "Returns a single anime with its associated Link, UserEntry, studios, and franchise entries for the current user.",
          tags: ["Anime"],
          responses: {
            "200": resp(
              "Anime detail with link, userEntry, studios, franchiseEntries",
            ),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
          },
        },
        patch: {
          operationId: "updateAnime",
          summary: "Update anime or user entry",
          description:
            "Updates anime metadata fields and/or the user's watch entry (status, score, episode, dates, notes, etc.) in a single request. Fields are automatically split and applied to the correct table.",
          tags: ["Anime"],
          requestBody: jsonBody(UpdateAnimeSchema),
          responses: {
            "200": resp("Updated anime detail object"),
            "400": resp("Validation error"),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
          },
        },
        delete: {
          operationId: "deleteAnime",
          summary: "Remove from library",
          description:
            "Removes the user's watch entry. The Link and LinkedAnime records are preserved to maintain collection structure.",
          tags: ["Anime"],
          responses: {
            "200": resp("{ ok: true }"),
            "401": resp("Unauthorized"),
          },
        },
      },

      "/api/anime/{id}/episode": {
        parameters: [pathParam("id", "Anime ID")],
        patch: {
          operationId: "incrementEpisode",
          summary: "Increment episode counter",
          description:
            "Increments `currentEpisode` by 1. Auto-starts watch tracking if not already started. Auto-completes the entry when the last episode is reached across all linked anime.",
          tags: ["Anime"],
          responses: {
            "200": resp("Updated UserEntry"),
            "401": resp("Unauthorized"),
            "404": resp("Entry not found"),
          },
        },
      },

      "/api/anime/{id}/entry": {
        parameters: [pathParam("id", "Anime ID")],
        post: {
          operationId: "upsertEntry",
          summary: "Create or update user entry",
          description:
            "Creates or updates the user's watch entry for the given anime. Creates a Link and LinkedAnime if none exists.",
          tags: ["Anime"],
          requestBody: jsonBody(UpdateUserEntrySchema),
          responses: {
            "200": resp("UserEntry"),
            "400": resp("Validation error"),
            "401": resp("Unauthorized"),
          },
        },
        delete: {
          operationId: "deleteEntry",
          summary: "Remove user entry",
          description:
            "Removes the user's watch entry without deleting the anime record or Link.",
          tags: ["Anime"],
          responses: {
            "200": resp("{ ok: true }"),
            "401": resp("Unauthorized"),
          },
        },
      },

      "/api/anime/{id}/add-to-library": {
        parameters: [pathParam("id", "Anime ID")],
        post: {
          operationId: "addToLibrary",
          summary: "Add existing anime to library",
          description:
            "Adds an anime that already exists in the global catalog to the current user's library.",
          tags: ["Anime"],
          responses: {
            "201": resp("Created entry"),
            "401": resp("Unauthorized"),
            "409": resp("Already in library"),
          },
        },
      },

      "/api/anime/{id}/link": {
        parameters: [pathParam("id", "Anime ID")],
        post: {
          operationId: "linkAnime",
          summary: "Link a sequel or related anime",
          description:
            "Looks up an anime on AniList and adds it to the same Link as this anime — useful for grouping sequels under one entry.",
          tags: ["Links"],
          requestBody: jsonBody(LinkAniListSchema),
          responses: {
            "200": resp("Updated Link"),
            "401": resp("Unauthorized"),
            "404": resp("AniList entry not found"),
          },
        },
      },

      "/api/anime/{id}/streaming": {
        parameters: [pathParam("id", "Anime ID")],
        get: {
          operationId: "listStreamingLinks",
          summary: "Get streaming links",
          description: "Returns all streaming service links for the given anime.",
          tags: ["Streaming"],
          responses: {
            "200": resp("Array of streaming links"),
            "401": resp("Unauthorized"),
          },
        },
        post: {
          operationId: "upsertStreamingLink",
          summary: "Add or update a streaming link",
          description:
            "Creates or updates a streaming link. Each service can have at most one link per anime (upsert by service).",
          tags: ["Streaming"],
          requestBody: jsonBody(CreateStreamingLinkSchema),
          responses: {
            "201": resp("Streaming link"),
            "400": resp("Validation error"),
            "401": resp("Unauthorized"),
          },
        },
      },

      "/api/anime/{id}/streaming/refresh": {
        parameters: [pathParam("id", "Anime ID")],
        post: {
          operationId: "refreshStreamingLinks",
          summary: "Refresh streaming availability",
          description:
            "Re-fetches where-to-watch data from TMDB and updates the streaming links for this anime.",
          tags: ["Streaming"],
          responses: {
            "200": resp("Updated streaming links array"),
            "401": resp("Unauthorized"),
          },
        },
      },

      "/api/anime/{id}/sync": {
        parameters: [pathParam("id", "Anime ID")],
        post: {
          operationId: "syncAnime",
          summary: "Sync metadata from AniList",
          description:
            "Re-fetches all metadata from AniList and updates the local record. Also refreshes TMDB season data unless `?anilistOnly=true`.",
          tags: ["Sync"],
          parameters: [
            queryParam("anilistOnly", "Set to 'true' to skip TMDB season refresh"),
          ],
          responses: {
            "200": resp("Updated anime"),
            "400": resp("Not an AniList entry"),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
            "502": resp("AniList fetch failed"),
          },
        },
      },

      // ─── Links ────────────────────────────────────────────────────────────────

      "/api/links/{id}": {
        parameters: [pathParam("id", "Link ID")],
        get: {
          operationId: "getLink",
          summary: "Get link",
          description:
            "Returns a Link with all its linked anime (ordered) and the user's watch entry.",
          tags: ["Links"],
          responses: {
            "200": resp("Link detail with linkedAnime and userEntry"),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
          },
        },
        patch: {
          operationId: "updateLink",
          summary: "Rename link",
          description:
            "Sets a custom display name for the link. Pass `null` to reset to the auto-generated name.",
          tags: ["Links"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: {
                      type: ["string", "null"],
                      description: "Custom name, or null to reset",
                    },
                  },
                  required: ["name"],
                },
              },
            },
          },
          responses: {
            "200": resp("Updated link"),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
          },
        },
      },

      "/api/links/{id}/anime": {
        parameters: [pathParam("id", "Link ID")],
        get: {
          operationId: "getLinkAnime",
          summary: "List anime in link",
          description:
            "Returns all anime entries in a link, ordered by position.",
          tags: ["Links"],
          responses: {
            "200": resp("Array of anime"),
            "401": resp("Unauthorized"),
          },
        },
        post: {
          operationId: "addAnimeToLink",
          summary: "Add anime to link",
          description:
            "Adds an anime as a new position in this link. Accepts `{ animeId }` (existing catalog ID), `{ anilistId }` (fetched from AniList if not in catalog), or `{ manual: { title, totalEpisodes? } }`.",
          tags: ["Links"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { type: "object", properties: { animeId: { type: "integer" } }, required: ["animeId"] },
                    { type: "object", properties: { anilistId: { type: "integer" } }, required: ["anilistId"] },
                    { type: "object", properties: { manual: { type: "object", properties: { title: { type: "string" }, totalEpisodes: { type: "integer" } }, required: ["title"] } }, required: ["manual"] },
                  ],
                },
              },
            },
          },
          responses: {
            "200": resp("Updated link"),
            "401": resp("Unauthorized"),
          },
        },
      },

      "/api/links/{id}/anime/{animeId}": {
        parameters: [
          pathParam("id", "Link ID"),
          pathParam("animeId", "Anime ID to remove"),
        ],
        delete: {
          operationId: "removeAnimeFromLink",
          summary: "Remove anime from link",
          description:
            "Detaches a single anime entry from a link. The anime remains in the global catalog.",
          tags: ["Links"],
          responses: {
            "200": resp("{ ok: true }"),
            "401": resp("Unauthorized"),
          },
        },
      },

      "/api/links/{id}/order": {
        parameters: [pathParam("id", "Link ID")],
        patch: {
          operationId: "reorderLink",
          summary: "Reorder anime in link",
          description:
            "Updates the display order of anime within a link. Provide an array of anime IDs in desired order.",
          tags: ["Links"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    order: {
                      type: "array",
                      items: { type: "integer" },
                      description: "Anime IDs in desired display order",
                    },
                  },
                  required: ["order"],
                },
              },
            },
          },
          responses: {
            "200": resp("Updated link"),
            "401": resp("Unauthorized"),
          },
        },
      },

      // ─── Franchises ───────────────────────────────────────────────────────────

      "/api/franchises": {
        get: {
          operationId: "listFranchises",
          summary: "List franchises",
          description:
            "Returns franchise groups with their anime entries and watch statuses. Paginated — default 50 per page, max 100.",
          tags: ["Franchises"],
          parameters: [
            queryParam("page", "Page number (default 1)"),
            queryParam("limit", "Results per page (default 50, max 100)"),
          ],
          responses: {
            "200": resp("{ data: Franchise[], total: number, page: number, limit: number, pages: number }"),
            "401": resp("Unauthorized"),
          },
        },
        post: {
          operationId: "createFranchise",
          summary: "Create franchise",
          description: "Creates a new franchise group.",
          tags: ["Franchises"],
          requestBody: jsonBody(CreateFranchiseSchema),
          responses: {
            "201": resp("Created franchise"),
            "400": resp("Validation error"),
            "401": resp("Unauthorized"),
          },
        },
      },

      "/api/franchises/{id}": {
        parameters: [pathParam("id", "Franchise ID")],
        get: {
          operationId: "getFranchise",
          summary: "Get franchise",
          description: "Returns a franchise with all its entries.",
          tags: ["Franchises"],
          responses: {
            "200": resp("Franchise detail with entries"),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
          },
        },
        patch: {
          operationId: "updateFranchise",
          summary: "Update franchise",
          description: "Updates the name or description of a franchise.",
          tags: ["Franchises"],
          requestBody: jsonBody(UpdateFranchiseSchema),
          responses: {
            "200": resp("Updated franchise"),
            "400": resp("Validation error"),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
          },
        },
      },

      "/api/franchise-entries/{id}": {
        parameters: [pathParam("id", "Franchise entry ID")],
        get: {
          operationId: "getFranchiseEntry",
          summary: "Get franchise entry",
          description: "Returns a single franchise entry.",
          tags: ["Franchises"],
          responses: {
            "200": resp("Franchise entry"),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
          },
        },
        patch: {
          operationId: "updateFranchiseEntry",
          summary: "Update franchise entry",
          description:
            "Updates the entry type or display order of an anime within a franchise.",
          tags: ["Franchises"],
          requestBody: jsonBody(
            AddAnimeToFranchiseSchema.pick({ order: true, entryType: true }),
          ),
          responses: {
            "200": resp("Updated franchise entry"),
            "401": resp("Unauthorized"),
          },
        },
      },

      // ─── People ───────────────────────────────────────────────────────────────

      "/api/people": {
        get: {
          operationId: "listPeople",
          summary: "List people",
          description:
            "Returns people (recommenders/watchers) with their recommendation stats — total count, rated count, average score. Paginated — default 100 per page, max 200.",
          tags: ["People"],
          parameters: [
            queryParam("page", "Page number (default 1)"),
            queryParam("limit", "Results per page (default 100, max 200)"),
          ],
          responses: {
            "200": resp(
              "{ data: { id, name, totalRecommendations, ratedCount, avgScore }[], total: number, page: number, limit: number, pages: number }",
            ),
            "401": resp("Unauthorized"),
          },
        },
        post: {
          operationId: "createPerson",
          summary: "Create person",
          description: "Creates a new person in the user's people list.",
          tags: ["People"],
          requestBody: jsonBody(CreatePersonSchema),
          responses: {
            "201": resp("Created person"),
            "400": resp("Validation error"),
            "401": resp("Unauthorized"),
          },
        },
      },

      "/api/people/{id}": {
        parameters: [pathParam("id", "Person ID")],
        get: {
          operationId: "getPerson",
          summary: "Get person",
          description: "Returns a single person with their recommendation history.",
          tags: ["People"],
          responses: {
            "200": resp("Person detail"),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
          },
        },
        patch: {
          operationId: "updatePerson",
          summary: "Update person",
          description: "Updates a person's name.",
          tags: ["People"],
          requestBody: jsonBody(CreatePersonSchema),
          responses: {
            "200": resp("Updated person"),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
          },
        },
        delete: {
          operationId: "deletePerson",
          summary: "Delete person",
          description:
            "Permanently deletes a person. Does not affect associated anime entries.",
          tags: ["People"],
          responses: {
            "200": resp("{ ok: true }"),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
          },
        },
      },

      // ─── Import / Export ──────────────────────────────────────────────────────

      "/api/export": {
        get: {
          operationId: "exportLibrary",
          summary: "Export library as CSV",
          description:
            "Downloads the user's full library as a CSV file. Supports optional filters.",
          tags: ["Import/Export"],
          parameters: [
            queryParam(
              "status",
              "Filter by watch status: WATCHING | COMPLETED | DROPPED | PLAN_TO_WATCH | NOT_INTERESTED",
            ),
            queryParam("franchise", "Filter by franchise ID"),
            queryParam("format", "Filter by format: SERIES | MOVIE"),
            queryParam("search", "Filter by title search query"),
          ],
          responses: {
            "200": {
              description: "CSV file download",
              content: {
                "text/csv": { schema: { type: "string", format: "binary" } },
              },
            },
            "401": resp("Unauthorized"),
          },
        },
      },

      "/api/import": {
        post: {
          operationId: "importLibrary",
          summary: "Import library from CSV",
          description:
            "Imports anime from a CSV file previously exported by this app. Pass `mode=preview` for a dry run that returns counts only. For real imports, provide `conflictMode` to control how existing entries are handled.",
          tags: ["Import/Export"],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    file: {
                      type: "string",
                      format: "binary",
                      description: "CSV file to import",
                    },
                    mode: {
                      type: "string",
                      enum: ["preview"],
                      description:
                        "Pass 'preview' for a dry run — returns counts, no writes",
                    },
                    conflictMode: {
                      type: "string",
                      enum: ["update", "skip"],
                      description:
                        "What to do with entries already in your library",
                    },
                  },
                  required: ["file"],
                },
              },
            },
          },
          responses: {
            "200": resp(
              "Preview: { newCount, existingCount, invalidCount } — Import: { imported, updated, skipped, errors }",
            ),
            "400": resp("Invalid or unreadable CSV"),
            "401": resp("Unauthorized"),
          },
        },
      },

      // ─── Streaming ────────────────────────────────────────────────────────────

      "/api/streaming/{linkId}": {
        parameters: [
          {
            name: "linkId",
            in: "path",
            required: true,
            description: "Streaming link record ID",
            schema: { type: "integer" },
          },
        ],
        get: {
          operationId: "getStreamingLink",
          summary: "Get streaming link",
          description: "Returns a single streaming link record by ID.",
          tags: ["Streaming"],
          responses: {
            "200": resp("Streaming link"),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
          },
        },
        delete: {
          operationId: "deleteStreamingLink",
          summary: "Delete streaming link",
          description: "Permanently removes a streaming link.",
          tags: ["Streaming"],
          responses: {
            "200": resp("{ ok: true }"),
            "401": resp("Unauthorized"),
            "404": resp("Not found"),
          },
        },
      },

      // ─── Search ───────────────────────────────────────────────────────────────

      "/api/anilist/search": {
        get: {
          operationId: "searchAniList",
          summary: "Search AniList",
          description:
            "Searches the AniList catalog for anime by title. Does not require authentication.",
          tags: ["Search"],
          parameters: [queryParam("q", "Search query", true)],
          responses: {
            "200": resp("AniList search results"),
          },
        },
      },

      "/api/tmdb/search": {
        get: {
          operationId: "searchTmdb",
          summary: "Search TMDB for TV shows or movies",
          tags: ["Search"],
          parameters: [
            queryParam("q", "Search query", true),
            {
              name: "type",
              in: "query" as const,
              required: false,
              description: "Media type to search: tv or movie (default tv)",
              schema: { type: "string", enum: ["tv", "movie"], default: "tv" },
            },
          ],
          responses: {
            "200": resp(
              "Array of { id, name, year, mediaType, posterUrl }",
            ),
            "401": resp("Unauthorized"),
          },
        },
      },

      // ─── Sync ─────────────────────────────────────────────────────────────────

      "/api/sync-all": {
        post: {
          operationId: "syncAll",
          summary: "Sync all anime",
          description:
            "Re-fetches AniList metadata and streaming links for every anime in the library. Subject to a 5-minute cooldown. Returns 409 if a sync is already in progress for this user.",
          tags: ["Sync"],
          responses: {
            "200": resp("{ synced: number, errors: number, total: number, failed: { id: number, title: string, reason: string }[] }"),
            "401": resp("Unauthorized"),
            "409": resp("Sync already in progress"),
            "429": resp("Cooldown active — wait before re-syncing"),
          },
        },
      },

      // ─── Utilities ────────────────────────────────────────────────────────────

      "/api/sidebar-feature": {
        get: {
          operationId: "getSidebarFeature",
          summary: "Get sidebar spotlight anime",
          description:
            "Returns a random recently-completed anime with its cover image and score for the sidebar spotlight widget.",
          tags: ["Utilities"],
          responses: {
            "200": resp("{ coverImageUrl, title, score } or null"),
            "401": resp("Unauthorized"),
          },
        },
      },

      "/api/discovery-sources": {
        get: {
          operationId: "getDiscoverySources",
          summary: "List discovery sources",
          description:
            "Returns the distinct list of discovery source strings from the user's entries (e.g. 'Reddit', 'MAL').",
          tags: ["Utilities"],
          responses: {
            "200": resp("Array of strings"),
            "401": resp("Unauthorized"),
          },
        },
      },

      // ─── Profile ──────────────────────────────────────────────────────────────

      "/api/profile/delete": {
        delete: {
          operationId: "deleteProfile",
          summary: "Delete account",
          description:
            "Permanently deletes the user's account and all associated data — library, entries, franchises, and people. This is irreversible.",
          tags: ["Profile"],
          responses: {
            "200": resp("{ ok: true }"),
            "401": resp("Unauthorized"),
          },
        },
      },
    },
  };
}
