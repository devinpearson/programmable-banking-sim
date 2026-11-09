import { PrismaClient } from '@prisma/client'
import dayjs from 'dayjs'
import { TransactionType } from './types.js'

const prisma = new PrismaClient()

// A scenario is a named starting state for the sandbox: a set of accounts with
// opening balances (and optional beneficiaries) so a hackathon or demo can
// begin from a known setup instead of the default seed.
export interface ScenarioAccount {
  accountId: string
  accountNumber: string
  accountName: string
  productName: string
  openingBalance: number
}

export interface ScenarioBeneficiary {
  beneficiaryId: string
  accountNumber: string
  name: string
  beneficiaryName: string
  bank: string
}

export interface Scenario {
  id: string
  name: string
  description: string
  profile: { profileId: string; profileName: string }
  accounts: ScenarioAccount[]
  beneficiaries?: ScenarioBeneficiary[]
}

const PROFILE = { profileId: '20000000000001', profileName: 'Sandbox User' }

export const scenarios: Scenario[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Two accounts — a funded transactional account and an empty savings account.',
    profile: PROFILE,
    accounts: [
      {
        accountId: '30000000000000000000001',
        accountNumber: '20000000001',
        accountName: 'Main Account',
        productName: 'Private Bank Account',
        openingBalance: 10000,
      },
      {
        accountId: '30000000000000000000002',
        accountNumber: '20000000002',
        accountName: 'Savings Account',
        productName: 'Savings Account',
        openingBalance: 0,
      },
    ],
  },
  {
    id: 'overdrawn',
    name: 'Overdrawn',
    description: 'A current account in overdraft alongside a well-funded savings account.',
    profile: PROFILE,
    accounts: [
      {
        accountId: '30000000000000000000011',
        accountNumber: '20000000011',
        accountName: 'Current Account',
        productName: 'Private Bank Account',
        openingBalance: -2500,
      },
      {
        accountId: '30000000000000000000012',
        accountNumber: '20000000012',
        accountName: 'Savings Account',
        productName: 'Savings Account',
        openingBalance: 15000,
      },
    ],
  },
  {
    id: 'hackathon',
    name: 'Hackathon',
    description: 'Three varied accounts plus a couple of beneficiaries for payment testing.',
    profile: PROFILE,
    accounts: [
      {
        accountId: '30000000000000000000021',
        accountNumber: '20000000021',
        accountName: 'Cheque Account',
        productName: 'Private Bank Account',
        openingBalance: 25000,
      },
      {
        accountId: '30000000000000000000022',
        accountNumber: '20000000022',
        accountName: 'Savings Account',
        productName: 'Savings Account',
        openingBalance: 50000,
      },
      {
        accountId: '30000000000000000000023',
        accountNumber: '20000000023',
        accountName: 'Credit Card',
        productName: 'Credit Card Account',
        openingBalance: -1200,
      },
    ],
    beneficiaries: [
      {
        beneficiaryId: 'scenario-bene-001',
        accountNumber: '20000000099',
        name: 'Alice Supplier',
        beneficiaryName: 'Alice Supplier',
        bank: 'INVESTEC BANK LIMITED',
      },
      {
        beneficiaryId: 'scenario-bene-002',
        accountNumber: '20000000098',
        name: 'Bob Services',
        beneficiaryName: 'Bob Services',
        bank: 'CAPITEC BANK LIMITED',
      },
    ],
  },
]

// Public metadata only — no need to leak the full account layout to the list.
export function listScenarios() {
  return scenarios.map(({ id, name, description }) => ({ id, name, description }))
}

function openingTransaction(accountId: string, openingBalance: number) {
  const today = dayjs().format('YYYY-MM-DD')
  const credit = openingBalance >= 0
  return {
    accountId: accountId,
    type: credit ? TransactionType.CREDIT : TransactionType.DEBIT,
    transactionType: 'Deposit',
    status: 'POSTED',
    description: 'Opening balance',
    cardNumber: '',
    postedOrder: 0,
    postingDate: today,
    valueDate: today,
    actionDate: today,
    transactionDate: today,
    amount: Math.abs(openingBalance),
    runningBalance: 0,
  }
}

// Replace the account-related data with the chosen scenario. Cards, currencies,
// countries, merchants and settings are left untouched. Returns null for an
// unknown id so the caller can respond with 404.
export async function applyScenario(id: string) {
  const scenario = scenarios.find(s => s.id === id)
  if (!scenario) {
    return null
  }

  // Clear existing account data. Deleting accounts also cascades their
  // transactions, but the explicit deletes keep the intent obvious.
  await prisma.transaction.deleteMany()
  await prisma.beneficiary.deleteMany()
  await prisma.account.deleteMany()
  await prisma.profile.deleteMany()

  await prisma.profile.create({ data: scenario.profile })

  for (const account of scenario.accounts) {
    await prisma.account.create({
      data: {
        accountId: account.accountId,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        referenceName: account.accountName,
        productName: account.productName,
        kycCompliant: true,
        profileId: scenario.profile.profileId,
        profileName: scenario.profile.profileName,
      },
    })
    if (account.openingBalance !== 0) {
      await prisma.transaction.create({
        data: openingTransaction(account.accountId, account.openingBalance),
      })
    }
  }

  for (const beneficiary of scenario.beneficiaries ?? []) {
    await prisma.beneficiary.create({
      data: {
        beneficiaryId: beneficiary.beneficiaryId,
        accountNumber: beneficiary.accountNumber,
        code: '',
        bank: beneficiary.bank,
        beneficiaryName: beneficiary.beneficiaryName,
        lastPaymentAmount: '0.00',
        lastPaymentDate: '',
        name: beneficiary.name,
        referenceAccountNumber: '',
        referenceName: '',
        categoryId: '',
        profileId: scenario.profile.profileId,
      },
    })
  }

  return {
    id: scenario.id,
    name: scenario.name,
    accounts: scenario.accounts.length,
    beneficiaries: scenario.beneficiaries?.length ?? 0,
  }
}
