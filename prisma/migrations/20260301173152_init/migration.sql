-- CreateEnum
CREATE TYPE "AnimeSource" AS ENUM ('ANILIST', 'MANUAL');

-- CreateEnum
CREATE TYPE "AiringStatus" AS ENUM ('FINISHED', 'RELEASING', 'HIATUS', 'CANCELLED', 'NOT_YET_RELEASED');

-- CreateEnum
CREATE TYPE "DisplayFormat" AS ENUM ('SERIES', 'MOVIE');

-- CreateEnum
CREATE TYPE "SourceMaterial" AS ENUM ('ORIGINAL', 'MANGA', 'LIGHT_NOVEL', 'NOVEL', 'VISUAL_NOVEL', 'VIDEO_GAME', 'OTHER');

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('WINTER', 'SPRING', 'SUMMER', 'FALL');

-- CreateEnum
CREATE TYPE "FranchiseEntryType" AS ENUM ('MAIN', 'SIDE_STORY', 'MOVIE', 'OVA');

-- CreateEnum
CREATE TYPE "WatchStatus" AS ENUM ('WATCHING', 'COMPLETED', 'ON_HOLD', 'DROPPED', 'PLAN_TO_WATCH', 'RECOMMENDED', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "StreamingService" AS ENUM ('NETFLIX', 'HULU', 'DISNEY_PLUS', 'HBO', 'CRUNCHYROLL', 'AMAZON_PRIME', 'HIDIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Franchise" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Franchise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseEntry" (
    "id" SERIAL NOT NULL,
    "franchiseId" INTEGER NOT NULL,
    "animeId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "entryType" "FranchiseEntryType" NOT NULL DEFAULT 'MAIN',

    CONSTRAINT "FranchiseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Studio" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "anilistStudioId" INTEGER,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimeStudio" (
    "animeId" INTEGER NOT NULL,
    "studioId" INTEGER NOT NULL,
    "isMainStudio" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AnimeStudio_pkey" PRIMARY KEY ("animeId","studioId")
);

-- CreateTable
CREATE TABLE "Anime" (
    "id" SERIAL NOT NULL,
    "anilistId" INTEGER,
    "source" "AnimeSource" NOT NULL DEFAULT 'ANILIST',
    "titleEnglish" TEXT,
    "titleRomaji" TEXT NOT NULL,
    "titleNative" TEXT,
    "coverImageUrl" TEXT,
    "synopsis" TEXT,
    "genres" TEXT NOT NULL DEFAULT '[]',
    "totalEpisodes" INTEGER,
    "totalSeasons" INTEGER,
    "episodesPerSeason" TEXT,
    "durationMins" INTEGER,
    "airingStatus" "AiringStatus" NOT NULL DEFAULT 'FINISHED',
    "displayFormat" "DisplayFormat" NOT NULL DEFAULT 'SERIES',
    "sourceMaterial" "SourceMaterial",
    "season" "Season",
    "seasonYear" INTEGER,
    "meanScore" INTEGER,
    "nextAiringEp" INTEGER,
    "nextAiringAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "tmdbId" INTEGER,
    "tmdbMediaType" TEXT,
    "externalUrl" TEXT,
    "streamingCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamingLink" (
    "id" SERIAL NOT NULL,
    "animeId" INTEGER NOT NULL,
    "service" "StreamingService" NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "StreamingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEntry" (
    "id" SERIAL NOT NULL,
    "animeId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "watchStatus" "WatchStatus" NOT NULL DEFAULT 'PLAN_TO_WATCH',
    "currentEpisode" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION,
    "notes" TEXT,
    "watchContextPersonId" INTEGER,
    "recommenderId" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Person_name_userId_key" ON "Person"("name", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_name_userId_key" ON "Franchise"("name", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseEntry_franchiseId_animeId_key" ON "FranchiseEntry"("franchiseId", "animeId");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseEntry_franchiseId_order_key" ON "FranchiseEntry"("franchiseId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_name_key" ON "Studio"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_anilistStudioId_key" ON "Studio"("anilistStudioId");

-- CreateIndex
CREATE UNIQUE INDEX "Anime_anilistId_key" ON "Anime"("anilistId");

-- CreateIndex
CREATE UNIQUE INDEX "StreamingLink_animeId_service_key" ON "StreamingLink"("animeId", "service");

-- CreateIndex
CREATE UNIQUE INDEX "UserEntry_animeId_userId_key" ON "UserEntry"("animeId", "userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Franchise" ADD CONSTRAINT "Franchise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseEntry" ADD CONSTRAINT "FranchiseEntry_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseEntry" ADD CONSTRAINT "FranchiseEntry_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeStudio" ADD CONSTRAINT "AnimeStudio_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeStudio" ADD CONSTRAINT "AnimeStudio_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamingLink" ADD CONSTRAINT "StreamingLink_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEntry" ADD CONSTRAINT "UserEntry_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEntry" ADD CONSTRAINT "UserEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEntry" ADD CONSTRAINT "UserEntry_watchContextPersonId_fkey" FOREIGN KEY ("watchContextPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEntry" ADD CONSTRAINT "UserEntry_recommenderId_fkey" FOREIGN KEY ("recommenderId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
