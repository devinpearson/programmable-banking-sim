/*
  Warnings:

  - The primary key for the `Transaction` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `transactionId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "transactionId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "postedOrder" DECIMAL NOT NULL,
    "postingDate" TEXT NOT NULL,
    "valueDate" TEXT NOT NULL,
    "actionDate" TEXT NOT NULL,
    "transactionDate" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "runningBalance" DECIMAL NOT NULL
);
INSERT INTO "new_Transaction" ("accountId", "actionDate", "amount", "cardNumber", "description", "postedOrder", "postingDate", "runningBalance", "status", "transactionDate", "transactionType", "type", "valueDate") SELECT "accountId", "actionDate", "amount", "cardNumber", "description", "postedOrder", "postingDate", "runningBalance", "status", "transactionDate", "transactionType", "type", "valueDate" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
