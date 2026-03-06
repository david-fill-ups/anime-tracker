-- CreateEnum
CREATE TYPE "DiscoveryType" AS ENUM ('PERSONAL', 'PLATFORM', 'OTHER', 'UNKNOWN');

-- AlterTable
ALTER TABLE "UserEntry" ADD COLUMN     "discoverySource" TEXT,
ADD COLUMN     "discoveryType" "DiscoveryType";
