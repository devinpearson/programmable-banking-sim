-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CardExecution" (
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
    "updatedAt" DATETIME,
    CONSTRAINT "CardExecution_cardKey_fkey" FOREIGN KEY ("cardKey") REFERENCES "Card" ("cardKey") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CardExecution" ("authorizationApproved", "cardKey", "completedAt", "createdAt", "emailCount", "executionId", "pushNotificationCount", "rootCodeFunctionId", "sandbox", "smsCount", "startedAt", "type", "updatedAt") SELECT "authorizationApproved", "cardKey", "completedAt", "createdAt", "emailCount", "executionId", "pushNotificationCount", "rootCodeFunctionId", "sandbox", "smsCount", "startedAt", "type", "updatedAt" FROM "CardExecution";
DROP TABLE "CardExecution";
ALTER TABLE "new_CardExecution" RENAME TO "CardExecution";
CREATE INDEX "CardExecution_cardKey_idx" ON "CardExecution"("cardKey");
CREATE TABLE "new_CardExecutionLog" (
    "logId" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "level" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    CONSTRAINT "CardExecutionLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "CardExecution" ("executionId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CardExecutionLog" ("content", "createdAt", "executionId", "level", "logId") SELECT "content", "createdAt", "executionId", "level", "logId" FROM "CardExecutionLog";
DROP TABLE "CardExecutionLog";
ALTER TABLE "new_CardExecutionLog" RENAME TO "CardExecutionLog";
CREATE INDEX "CardExecutionLog_executionId_idx" ON "CardExecutionLog"("executionId");
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
    "runningBalance" DECIMAL NOT NULL,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("accountId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("accountId", "actionDate", "amount", "cardNumber", "description", "postedOrder", "postingDate", "runningBalance", "status", "transactionDate", "transactionId", "transactionType", "type", "valueDate") SELECT "accountId", "actionDate", "amount", "cardNumber", "description", "postedOrder", "postingDate", "runningBalance", "status", "transactionDate", "transactionId", "transactionType", "type", "valueDate" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Card_accountId_idx" ON "Card"("accountId");
