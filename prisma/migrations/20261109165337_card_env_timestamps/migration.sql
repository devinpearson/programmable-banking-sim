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
    "envs" TEXT NOT NULL,
    "envsCreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envsUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Card" ("accountId", "accountNumber", "cardKey", "cardNumber", "cardTypeCode", "envs", "isProgrammable", "publishedCode", "savedCode", "status") SELECT "accountId", "accountNumber", "cardKey", "cardNumber", "cardTypeCode", "envs", "isProgrammable", "publishedCode", "savedCode", "status" FROM "Card";
DROP TABLE "Card";
ALTER TABLE "new_Card" RENAME TO "Card";
CREATE INDEX "Card_accountId_idx" ON "Card"("accountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
