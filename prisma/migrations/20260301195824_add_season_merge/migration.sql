-- AlterTable
ALTER TABLE "Anime" ADD COLUMN     "mergedIntoId" INTEGER;

-- AddForeignKey
ALTER TABLE "Anime" ADD CONSTRAINT "Anime_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Anime"("id") ON DELETE SET NULL ON UPDATE CASCADE;
