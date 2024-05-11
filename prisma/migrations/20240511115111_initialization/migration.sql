-- CreateTable
CREATE TABLE "Account" (
    "accountId" TEXT NOT NULL PRIMARY KEY,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "referenceName" TEXT NOT NULL,
    "productName" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "accountId" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cardNumber" DECIMAL NOT NULL,
    "postedOrder" DECIMAL NOT NULL,
    "postingDate" TEXT NOT NULL,
    "valueDate" TEXT NOT NULL,
    "actionDate" TEXT NOT NULL,
    "transactionDate" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "runningBalance" DECIMAL NOT NULL
);

-- CreateTable
CREATE TABLE "Country" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Currency" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Merchant" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "beneficiaryId" TEXT NOT NULL PRIMARY KEY,
    "accountNumber" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "lastPaymentAmount" TEXT NOT NULL,
    "lastPaymentDate" TEXT NOT NULL,
    "cellNo" TEXT,
    "emailAddress" TEXT,
    "name" TEXT NOT NULL,
    "referenceAccountNumber" TEXT NOT NULL,
    "referenceName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL
);
