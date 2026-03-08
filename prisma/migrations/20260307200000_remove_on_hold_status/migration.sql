-- Migrate existing ON_HOLD entries to WATCHING before removing the enum value
UPDATE "UserEntry" SET "watchStatus" = 'WATCHING' WHERE "watchStatus" = 'ON_HOLD';

-- PostgreSQL doesn't support removing enum values directly.
-- Rename, recreate, recast, then drop old.
ALTER TYPE "WatchStatus" RENAME TO "WatchStatus_old";

CREATE TYPE "WatchStatus" AS ENUM ('WATCHING', 'COMPLETED', 'DROPPED', 'PLAN_TO_WATCH', 'RECOMMENDED', 'NOT_INTERESTED');

ALTER TABLE "UserEntry" ALTER COLUMN "watchStatus" DROP DEFAULT;
ALTER TABLE "UserEntry"
  ALTER COLUMN "watchStatus" TYPE "WatchStatus"
  USING "watchStatus"::text::"WatchStatus";
ALTER TABLE "UserEntry" ALTER COLUMN "watchStatus" SET DEFAULT 'PLAN_TO_WATCH'::"WatchStatus";

DROP TYPE "WatchStatus_old";
