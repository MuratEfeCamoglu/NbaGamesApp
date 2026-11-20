-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GameSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "era" TEXT NOT NULL DEFAULT 'all',
    "isDaily" BOOLEAN NOT NULL DEFAULT false,
    "dailyDate" TEXT,
    "seed" INTEGER NOT NULL,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GameSession" ("bestStreak", "correctCount", "createdAt", "currentIndex", "dailyDate", "difficulty", "finishedAt", "id", "isDaily", "lastActivityAt", "mode", "questionCount", "score", "seed", "status", "streak", "total", "userId") SELECT "bestStreak", "correctCount", "createdAt", "currentIndex", "dailyDate", "difficulty", "finishedAt", "id", "isDaily", "lastActivityAt", "mode", "questionCount", "score", "seed", "status", "streak", "total", "userId" FROM "GameSession";
DROP TABLE "GameSession";
ALTER TABLE "new_GameSession" RENAME TO "GameSession";
CREATE INDEX "GameSession_userId_status_finishedAt_idx" ON "GameSession"("userId", "status", "finishedAt");
CREATE INDEX "GameSession_dailyDate_status_idx" ON "GameSession"("dailyDate", "status");
CREATE UNIQUE INDEX "GameSession_userId_dailyDate_key" ON "GameSession"("userId", "dailyDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
