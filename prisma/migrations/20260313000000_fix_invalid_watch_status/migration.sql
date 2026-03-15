-- Fix invalid watch states:
-- 1. PLAN_TO_WATCH with episode progress > 0 → WATCHING
UPDATE "UserEntry" SET "watchStatus" = 'WATCHING'
WHERE "watchStatus" = 'PLAN_TO_WATCH' AND "currentEpisode" > 0;

-- 2. WATCHING with no episode progress → PLAN_TO_WATCH
UPDATE "UserEntry" SET "watchStatus" = 'PLAN_TO_WATCH'
WHERE "watchStatus" = 'WATCHING' AND "currentEpisode" = 0;
