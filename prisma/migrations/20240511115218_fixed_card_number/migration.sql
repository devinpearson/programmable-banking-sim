-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "accountId" TEXT NOT NULL PRIMARY KEY,
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
