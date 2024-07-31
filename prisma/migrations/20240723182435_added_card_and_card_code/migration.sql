-- CreateTable
CREATE TABLE "Card" (
    "cardKey" TEXT NOT NULL PRIMARY KEY,
    "cardNumber" TEXT NOT NULL,
    "isProgrammable" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "cardTypeCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "publishedCode" TEXT,
    "savedCode" TEXT,
    "envs" TEXT
);

-- CreateTable
CREATE TABLE "CardCode" (
    "codeId" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME NULL
);
