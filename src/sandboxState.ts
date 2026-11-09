import { PrismaClient } from '@prisma/client'
import { z } from './schema/zod.js'
import { getClock, setOffsetDays } from './clock.js'

const prisma = new PrismaClient()

// Export and import the sandbox's data as one JSON document, so a setup can
// be saved, shared and loaded again. Covers the banking data, exchange
// rates, recurring transactions and the sandbox clock; settings (which hold secrets), fault settings and webhooks are
// configuration and are left out. Card execution logs are not included.

const STATE_VERSION = 1

const decimal = z.union([z.string(), z.number()]).transform(value => String(value))
const dateTime = z.string().datetime({ offset: true, message: 'must be an ISO date-time' })

export const sandboxStateSchema = z
  .object({
    version: z.literal(STATE_VERSION, { errorMap: () => ({ message: `must be ${STATE_VERSION}` }) }),
    exportedAt: dateTime.optional(),
    profiles: z.array(z.object({ profileId: z.string().min(1), profileName: z.string() })),
    accounts: z.array(
      z.object({
        accountId: z.string().min(1),
        accountNumber: z.string(),
        accountName: z.string(),
        referenceName: z.string(),
        productName: z.string(),
        kycCompliant: z.boolean(),
        profileId: z.string(),
        profileName: z.string(),
        overdraftLimit: decimal,
      }),
    ),
    transactions: z.array(
      z.object({
        transactionId: z.number().int().positive(),
        accountId: z.string(),
        type: z.enum(['DEBIT', 'CREDIT']),
        transactionType: z.string(),
        status: z.enum(['POSTED', 'PENDING']),
        description: z.string(),
        cardNumber: z.string(),
        postedOrder: decimal,
        postingDate: z.string(),
        valueDate: z.string(),
        actionDate: z.string(),
        transactionDate: z.string(),
        amount: decimal,
        runningBalance: decimal,
      }),
    ),
    beneficiaries: z.array(
      z.object({
        beneficiaryId: z.string().min(1),
        accountNumber: z.string(),
        code: z.string(),
        bank: z.string(),
        beneficiaryName: z.string(),
        lastPaymentAmount: z.string(),
        lastPaymentDate: z.string(),
        cellNo: z.string().nullable(),
        emailAddress: z.string().nullable(),
        name: z.string(),
        referenceAccountNumber: z.string(),
        referenceName: z.string(),
        categoryId: z.string(),
        profileId: z.string(),
      }),
    ),
    cards: z.array(
      z.object({
        cardKey: z.string().min(1),
        cardNumber: z.string(),
        isProgrammable: z.boolean(),
        status: z.string(),
        cardTypeCode: z.string(),
        accountNumber: z.string(),
        accountId: z.string(),
        publishedCode: z.string(),
        savedCode: z.string(),
        envs: z.string(),
        envsCreatedAt: dateTime,
        envsUpdatedAt: dateTime,
      }),
    ),
    cardCodes: z.array(
      z.object({
        codeId: z.string().min(1),
        code: z.string(),
        createdAt: dateTime,
        updatedAt: dateTime,
        publishedAt: dateTime.nullable(),
      }),
    ),
    exchangeRates: z.array(z.object({ currencyCode: z.string().length(3), zarPerUnit: decimal })),
    // Optional, so files exported before schedules existed still import.
    schedules: z
      .array(
        z.object({
          scheduleId: z.string().min(1),
          accountId: z.string(),
          description: z.string(),
          kind: z.enum(['fixed', 'interest']),
          type: z.enum(['DEBIT', 'CREDIT']),
          transactionType: z.string(),
          amount: decimal.nullable(),
          annualRatePercent: decimal.nullable(),
          frequency: z.enum(['monthly', 'weekly']),
          dayOfMonth: z.number().int().min(1).max(31).nullable(),
          dayOfWeek: z.number().int().min(0).max(6).nullable(),
          nextRunDate: z.string(),
          active: z.boolean(),
          createdAt: dateTime,
        }),
      )
      .default([]),
    clock: z.object({ offsetDays: z.number().int().min(0) }).optional(),
  })
  // Transactions belong to accounts (a database foreign key).
  .superRefine((state, context) => {
    const accountIds = new Set(state.accounts.map(a => a.accountId))
    state.schedules.forEach((schedule, i) => {
      if (!accountIds.has(schedule.accountId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['schedules', i, 'accountId'],
          message: `no account ${schedule.accountId} in this file`,
        })
      }
    })
    state.transactions.forEach((t, i) => {
      if (!accountIds.has(t.accountId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['transactions', i, 'accountId'],
          message: `no account ${t.accountId} in this file`,
        })
      }
    })
  })
  .openapi('SandboxState', { description: 'Everything GET /export returns and POST /import accepts.' })

export type SandboxState = z.infer<typeof sandboxStateSchema>

export async function exportState() {
  const [profiles, accounts, transactions, beneficiaries, cards, cardCodes, exchangeRates, schedules] = await Promise.all([
    prisma.profile.findMany(),
    prisma.account.findMany(),
    prisma.transaction.findMany({ orderBy: { transactionId: 'asc' } }),
    prisma.beneficiary.findMany(),
    prisma.card.findMany(),
    prisma.cardCode.findMany(),
    prisma.exchangeRate.findMany({ orderBy: { currencyCode: 'asc' } }),
    prisma.schedule.findMany({ orderBy: { createdAt: 'asc' } }),
  ])
  return {
    version: STATE_VERSION,
    exportedAt: new Date().toISOString(),
    profiles,
    accounts: accounts.map(a => ({ ...a, overdraftLimit: a.overdraftLimit.toString() })),
    transactions: transactions.map(t => ({
      ...t,
      postedOrder: t.postedOrder.toString(),
      amount: t.amount.toString(),
      runningBalance: t.runningBalance.toString(),
    })),
    beneficiaries,
    cards: cards.map(c => ({
      ...c,
      envsCreatedAt: c.envsCreatedAt.toISOString(),
      envsUpdatedAt: c.envsUpdatedAt.toISOString(),
    })),
    cardCodes: cardCodes.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      publishedAt: c.publishedAt?.toISOString() ?? null,
    })),
    exchangeRates: exchangeRates.map(r => ({ currencyCode: r.currencyCode, zarPerUnit: r.zarPerUnit.toString() })),
    schedules: schedules.map(schedule => ({
      ...schedule,
      amount: schedule.amount?.toString() ?? null,
      annualRatePercent: schedule.annualRatePercent?.toString() ?? null,
      createdAt: schedule.createdAt.toISOString(),
    })),
    clock: { offsetDays: getClock().offsetDays },
  }
}

// Replace the sandbox's data with a validated state, all or nothing.
export async function importState(state: SandboxState) {
  await prisma.$transaction([
    prisma.transaction.deleteMany(),
    prisma.card.deleteMany(),
    prisma.cardCode.deleteMany(),
    prisma.beneficiary.deleteMany(),
    prisma.account.deleteMany(),
    prisma.profile.deleteMany(),
    prisma.exchangeRate.deleteMany(),
    prisma.profile.createMany({ data: state.profiles }),
    prisma.account.createMany({ data: state.accounts }),
    prisma.transaction.createMany({ data: state.transactions }),
    prisma.beneficiary.createMany({ data: state.beneficiaries }),
    prisma.cardCode.createMany({ data: state.cardCodes }),
    prisma.card.createMany({ data: state.cards }),
    prisma.exchangeRate.createMany({ data: state.exchangeRates }),
    prisma.schedule.createMany({ data: state.schedules }),
  ])
  if (state.clock) await setOffsetDays(state.clock.offsetDays)
  return {
    profiles: state.profiles.length,
    accounts: state.accounts.length,
    transactions: state.transactions.length,
    beneficiaries: state.beneficiaries.length,
    cards: state.cards.length,
    exchangeRates: state.exchangeRates.length,
    schedules: state.schedules.length,
  }
}
