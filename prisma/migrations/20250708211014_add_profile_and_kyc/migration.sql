-- CreateTable
CREATE TABLE "Profile" (
    "profileId" TEXT NOT NULL PRIMARY KEY,
    "profileName" TEXT NOT NULL
);

-- Insert default profile
INSERT INTO "Profile" ("profileId", "profileName") VALUES ('10001234567890', 'Joe Soap');

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
    "profileId" TEXT NOT NULL,
    "profileName" TEXT NOT NULL
);
INSERT INTO "new_Account" ("accountId", "accountName", "accountNumber", "productName", "referenceName", "kycCompliant", "profileId", "profileName") 
SELECT "accountId", "accountName", "accountNumber", "productName", "referenceName", true, '10001234567890', 'Joe Soap' FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
