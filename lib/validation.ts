import { z } from "zod";
import { NextResponse } from "next/server";

// ── Primitive schemas ─────────────────────────────────────────────────────────

export const URLIdSchema = z.coerce.number().int().positive();

// ── Enum schemas ──────────────────────────────────────────────────────────────

export const WatchStatusSchema = z.enum([
  "PLAN_TO_WATCH",
  "WATCHING",
  "COMPLETED",
  "DROPPED",
  "NOT_INTERESTED",
]);

export const AiringStatusSchema = z.enum([
  "FINISHED",
  "RELEASING",
  "HIATUS",
  "CANCELLED",
  "NOT_YET_RELEASED",
]);

export const DisplayFormatSchema = z.enum(["SERIES", "MOVIE"]);

export const SourceMaterialSchema = z.enum([
  "ORIGINAL",
  "MANGA",
  "LIGHT_NOVEL",
  "NOVEL",
  "VISUAL_NOVEL",
  "VIDEO_GAME",
  "OTHER",
]);

export const SeasonSchema = z.enum(["WINTER", "SPRING", "SUMMER", "FALL"]);

export const FranchiseEntryTypeSchema = z.enum(["MAIN", "SIDE_STORY", "MOVIE", "OVA"]);

export const StreamingServiceSchema = z.enum([
  "NETFLIX",
  "HULU",
  "DISNEY_PLUS",
  "HBO",
  "CRUNCHYROLL",
  "AMAZON_PRIME",
  "HIDIVE",
]);

export const DiscoveryTypeSchema = z.enum(["PERSONAL", "PLATFORM", "OTHER", "UNKNOWN"]);

// ── Domain schemas ────────────────────────────────────────────────────────────

export const CreateAnimeAniListSchema = z.object({
  source: z.literal("ANILIST"),
  anilistId: z.number().int().positive(),
  watchStatus: WatchStatusSchema.optional(),
  watchContextPersonId: z.number().int().positive().nullable().optional(),
  recommenderId: z.number().int().positive().nullable().optional(),
  discoveryType: DiscoveryTypeSchema.nullable().optional(),
  discoverySource: z.string().nullable().optional(),
});

export const CreateAnimeManualSchema = z.object({
  source: z.literal("MANUAL"),
  titleRomaji: z.string().min(1),
  titleEnglish: z.string().nullable().optional(),
  titleNative: z.string().nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  synopsis: z.string().nullable().optional(),
  genres: z.array(z.string()).optional(),
  totalEpisodes: z.number().int().min(0).nullable().optional(),
  durationMins: z.number().int().min(0).nullable().optional(),
  airingStatus: AiringStatusSchema.optional(),
  displayFormat: DisplayFormatSchema.optional(),
  sourceMaterial: SourceMaterialSchema.nullable().optional(),
  season: SeasonSchema.nullable().optional(),
  seasonYear: z.number().int().nullable().optional(),
  watchStatus: WatchStatusSchema.optional(),
  watchContextPersonId: z.number().int().positive().nullable().optional(),
  recommenderId: z.number().int().positive().nullable().optional(),
  discoveryType: DiscoveryTypeSchema.nullable().optional(),
  discoverySource: z.string().nullable().optional(),
});

export const CreateAnimeSchema = z.discriminatedUnion("source", [
  CreateAnimeAniListSchema,
  CreateAnimeManualSchema,
]);

export const UpdateAnimeSchema = z.object({
  // UserEntry fields
  watchStatus: WatchStatusSchema.optional(),
  currentEpisode: z.number().int().min(0).optional(),
  score: z.number().min(1).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
  watchContextPersonId: z.number().int().positive().nullable().optional(),
  recommenderId: z.number().int().positive().nullable().optional(),
  discoveryType: DiscoveryTypeSchema.nullable().optional(),
  discoverySource: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  verified: z.boolean().optional(),
  // Anime metadata fields
  titleRomaji: z.string().min(1).optional(),
  titleEnglish: z.string().nullable().optional(),
  titleNative: z.string().nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  synopsis: z.string().nullable().optional(),
  totalEpisodes: z.number().int().min(0).nullable().optional(),
  durationMins: z.number().int().min(0).nullable().optional(),
  airingStatus: AiringStatusSchema.optional(),
  displayFormat: DisplayFormatSchema.optional(),
  sourceMaterial: SourceMaterialSchema.nullable().optional(),
  season: SeasonSchema.nullable().optional(),
  seasonYear: z.number().int().nullable().optional(),
  externalUrl: z.string().url().nullable().optional(),
});

export const UpdateUserEntrySchema = z.object({
  watchStatus: WatchStatusSchema,
});

export const CreateStreamingLinkSchema = z.object({
  service: StreamingServiceSchema,
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), { message: "URL must use https" }),
});

export const LinkAniListSchema = z.object({
  anilistId: z.number().int().positive(),
});

export const CreateFranchiseSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

export const UpdateFranchiseSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export const AddAnimeToFranchiseSchema = z.object({
  animeId: z.number().int().positive(),
  order: z.number().int().min(0).optional(),
  entryType: FranchiseEntryTypeSchema.optional(),
});

export const CreatePersonSchema = z.object({
  name: z.string().min(1),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid request", details: result.error.issues },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data as z.infer<T> };
}

export async function wrapHandler(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (err) {
    console.error("[api] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
