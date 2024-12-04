import { Card, CardExecution, CardExecutionLog, PrismaClient, Transaction } from '@prisma/client'
import { SettingType } from './types.js'
const prisma = new PrismaClient()

export async function getAccount(accountId: string) {
    return prisma.account.findFirst({
        where: {
          accountId: accountId,
        },
      })
}

export async function getAccounts() {
    return prisma.account.findMany()
}

export async function createAccount(account: any) {
    return prisma.account.create({
        data: account,
      })
}

export async function deleteAccount(accountId: string) {
    return prisma.account.delete({
        where: {
          accountId: accountId,
        },
      })
}

export async function deleteAllAccounts() {
    return prisma.account.deleteMany()
}

export async function getBeneficiary(beneficiaryId: string) {
    return prisma.beneficiary.findFirst({
        where: {
          beneficiaryId: beneficiaryId,
        },
      })
}

export async function getBeneficiaries() {
    return prisma.beneficiary.findMany()
}

export async function createBeneficiary(beneficiary: any) {
    return prisma.beneficiary.create({
        data: beneficiary,
      })
}

export async function deleteAllBeneficiaries() {
    return prisma.beneficiary.deleteMany()
}

export async function getTransactions(accountId: string) {
    return prisma.transaction.findMany({
        where: {
          accountId: accountId,
        },
      })
}

export async function createTransaction(transaction: any) {
    return prisma.transaction.create({
        data: transaction,
      })
}

export async function deleteTransactionsByDate(accountId: string, postingDate: string) {
    return prisma.transaction.deleteMany({
        where: {
          accountId: accountId,
          postingDate: postingDate,
        },
      })
}

export async function deleteTransactions(accountId: string) {
    return prisma.transaction.deleteMany({
        where: {
          accountId: accountId,
        },
      })
}

export async function deleteAllTransactions() {
    return prisma.transaction.deleteMany()
}

export async function getCard(cardKey: string) {
    return prisma.card.findFirst({
        where: {
          cardKey: cardKey,
        },
    })
}

export async function createCard(card: Card) {
    return prisma.card.create({
        data: card,
      })
}

export async function deleteCard(cardKey: string) {
    return prisma.card.delete({
        where: {
          cardKey: cardKey,
        },
      })
}

export async function deleteAllCards() {
    return prisma.card.deleteMany()
}

export async function getCardCode(codeId: string) {
    return prisma.cardCode.findFirst({
        where: {
          codeId: codeId,
        },
      })
}

export async function deleteAllCardCode() {
    return prisma.cardCode.deleteMany()
}

export async function updateProgrammable(cardKey: string, enabled: boolean) {
    return prisma.card.update({
        where: {
          cardKey: cardKey,
        },
        data: {
          isProgrammable: enabled,
        },
      })
}

export async function updateEnvs(cardKey: string, envs: string) {
    return prisma.card.update({
        where: {
          cardKey: cardKey,
        },
        data: {
          envs: envs,
        },
      })
}

export async function updateCode(codeId: string, code: string) {
    return prisma.cardCode.update({
        where: {
          codeId: codeId,
        },
        data: {
          code: code,
        },
      })
}

export async function getExecutions(cardKey: string) {
    return prisma.cardExecution.findMany({
        where: {
          cardKey: cardKey,
        },
      })
}

export async function createExecution(execution: CardExecution) {
    return prisma.cardExecution.create({
        data: execution,
    })
}

export async function createExecutionLog(log: CardExecutionLog) {
    return prisma.cardExecutionLog.create({
        data: log,
    })
}

export async function getExecutionLogs(executionId: string) {
    return prisma.cardExecutionLog.findMany({
        where: {
          executionId: executionId,
        },
      })
}

export async function getCards() {
    return prisma.card.findMany()
}

export async function getCountries() {
    return prisma.country.findMany()
}

export async function getCurrencies() {
    return prisma.currency.findMany()
}

export async function getMerchants() {
    return prisma.merchant.findMany()
}

export async function updateSetting(setting: SettingType, value: any) {
    return prisma.setting.update({
        where: { name: setting },
        data: { value: value },
      })
}

export async function getSettings() {
    return prisma.setting.findMany()
}