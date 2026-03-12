-- Migrate existing RECOMMENDED entries to PLAN_TO_WATCH before removing the enum value
UPDATE "UserEntry" SET "watchStatus" = 'PLAN_TO_WATCH' WHERE "watchStatus" = 'RECOMMENDED';

-- PostgreSQL doesn't support removing enum values directly.
-- Rename, recreate, recast, then drop old.
ALTER TYPE "WatchStatus" RENAME TO "WatchStatus_old";

CREATE TYPE "WatchStatus" AS ENUM ('WATCHING', 'COMPLETED', 'DROPPED', 'PLAN_TO_WATCH', 'NOT_INTERESTED');

ALTER TABLE "UserEntry" ALTER COLUMN "watchStatus" DROP DEFAULT;
ALTER TABLE "UserEntry"
  ALTER COLUMN "watchStatus" TYPE "WatchStatus"
  USING "watchStatus"::text::"WatchStatus";
ALTER TABLE "UserEntry" ALTER COLUMN "watchStatus" SET DEFAULT 'PLAN_TO_WATCH'::"WatchStatus";

DROP TYPE "WatchStatus_old";
