-- CreateTable
CREATE TABLE "Person" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Franchise" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FranchiseEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "franchiseId" INTEGER NOT NULL,
    "animeId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "entryType" TEXT NOT NULL DEFAULT 'MAIN',
    CONSTRAINT "FranchiseEntry_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FranchiseEntry_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Studio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "anilistStudioId" INTEGER
);

-- CreateTable
CREATE TABLE "AnimeStudio" (
    "animeId" INTEGER NOT NULL,
    "studioId" INTEGER NOT NULL,
    "isMainStudio" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("animeId", "studioId"),
    CONSTRAINT "AnimeStudio_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeStudio_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Anime" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "anilistId" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'ANILIST',
    "titleEnglish" TEXT,
    "titleRomaji" TEXT NOT NULL,
    "titleNative" TEXT,
    "coverImageUrl" TEXT,
    "synopsis" TEXT,
    "genres" TEXT NOT NULL DEFAULT '[]',
    "totalEpisodes" INTEGER,
    "durationMins" INTEGER,
    "airingStatus" TEXT NOT NULL DEFAULT 'FINISHED',
    "displayFormat" TEXT NOT NULL DEFAULT 'SERIES',
    "sourceMaterial" TEXT,
    "season" TEXT,
    "seasonYear" INTEGER,
    "meanScore" INTEGER,
    "nextAiringEp" INTEGER,
    "nextAiringAt" DATETIME,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "animeId" INTEGER NOT NULL,
    "watchStatus" TEXT NOT NULL DEFAULT 'PLAN_TO_WATCH',
    "currentEpisode" INTEGER NOT NULL DEFAULT 0,
    "score" REAL,
    "notes" TEXT,
    "watchContext" TEXT,
    "watchPartyWith" TEXT,
    "recommenderId" INTEGER,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "rewatchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserEntry_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserEntry_recommenderId_fkey" FOREIGN KEY ("recommenderId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_name_key" ON "Person"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_name_key" ON "Franchise"("name");

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
CREATE UNIQUE INDEX "UserEntry_animeId_key" ON "UserEntry"("animeId");
