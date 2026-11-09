-- CreateTable
CREATE TABLE "ExchangeRate" (
    "currencyCode" TEXT NOT NULL PRIMARY KEY,
    "zarPerUnit" DECIMAL NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
