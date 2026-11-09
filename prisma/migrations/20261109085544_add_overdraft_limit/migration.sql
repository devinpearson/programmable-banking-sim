-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "accountId" TEXT NOT NULL PRIMARY KEY,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "referenceName" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "kycCompliant" BOOLEAN NOT NULL DEFAULT true,
    "overdraftLimit" DECIMAL NOT NULL DEFAULT 0,
    "profileId" TEXT NOT NULL,
    "profileName" TEXT NOT NULL
);
INSERT INTO "new_Account" ("accountId", "accountName", "accountNumber", "kycCompliant", "productName", "profileId", "profileName", "referenceName") SELECT "accountId", "accountName", "accountNumber", "kycCompliant", "productName", "profileId", "profileName", "referenceName" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
