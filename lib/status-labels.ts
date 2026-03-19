import type { WatchStatus, AiringStatus, DisplayFormat } from "@/app/generated/prisma";

export const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  WATCHING: "Watching",
  COMPLETED: "Completed",
  DROPPED: "Dropped",
  PLAN_TO_WATCH: "Plan to Watch",
  NOT_INTERESTED: "Not Interested",
};

export const AIRING_STATUS_LABELS: Record<AiringStatus, string> = {
  FINISHED: "Finished",
  RELEASING: "Airing",
  HIATUS: "Hiatus",
  CANCELLED: "Cancelled",
  NOT_YET_RELEASED: "Upcoming",
};

export const DISPLAY_FORMAT_LABELS: Record<DisplayFormat, string> = {
  SERIES: "Series",
  MOVIE: "Movie",
};
