/*
  Warnings:

  - Made the column `envs` on table `Card` required. This step will fail if there are existing NULL values in that column.
  - Made the column `publishedCode` on table `Card` required. This step will fail if there are existing NULL values in that column.
  - Made the column `savedCode` on table `Card` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "CardExecution" (
    "executionId" TEXT NOT NULL PRIMARY KEY,
    "cardKey" TEXT NOT NULL,
    "rootCodeFunctionId" TEXT NOT NULL,
    "sandbox" BOOLEAN NOT NULL,
    "type" TEXT NOT NULL,
    "authorizationApproved" BOOLEAN,
    "smsCount" INTEGER NOT NULL,
    "emailCount" INTEGER NOT NULL,
    "pushNotificationCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "CardExecutionLog" (
    "logId" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "level" TEXT NOT NULL,
    "content" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Card" (
    "cardKey" TEXT NOT NULL PRIMARY KEY,
    "cardNumber" TEXT NOT NULL,
    "isProgrammable" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "cardTypeCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "publishedCode" TEXT NOT NULL,
    "savedCode" TEXT NOT NULL,
    "envs" TEXT NOT NULL
);
INSERT INTO "new_Card" ("accountId", "accountNumber", "cardKey", "cardNumber", "cardTypeCode", "envs", "isProgrammable", "publishedCode", "savedCode", "status") SELECT "accountId", "accountNumber", "cardKey", "cardNumber", "cardTypeCode", "envs", "isProgrammable", "publishedCode", "savedCode", "status" FROM "Card";
DROP TABLE "Card";
ALTER TABLE "new_Card" RENAME TO "Card";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
