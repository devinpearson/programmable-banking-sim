import { PrismaClient } from '@prisma/client'
import { TransactionStatus, TransactionType } from './types.js'

const prisma = new PrismaClient()

export interface AccountBalance {
  currentBalance: number
  availableBalance: number
  pendingDebits: number
  overdraftLimit: number
}

const toCents = (value: number) => Math.round(value * 100)

// Works out an account's balances the way a bank does:
// - currentBalance counts POSTED transactions only;
// - availableBalance is what can still be spent: the current balance plus the
//   overdraft limit, less any PENDING debits (card holds). Pending credits are
//   not spendable until they post.
// Sums are kept in cents so repeated additions don't drift.
// Returns null when the account does not exist.
export async function getAccountBalance(
  accountId: string,
): Promise<AccountBalance | null> {
  const account = await prisma.account.findUnique({ where: { accountId } })
  if (!account) {
    return null
  }
  const transactions = await prisma.transaction.findMany({
    where: { accountId },
    select: { type: true, status: true, amount: true },
  })
  let postedCents = 0
  let pendingDebitCents = 0
  for (const transaction of transactions) {
    const cents = toCents(transaction.amount.toNumber())
    if (transaction.status === TransactionStatus.PENDING) {
      if (transaction.type === TransactionType.DEBIT) {
        pendingDebitCents += cents
      }
      continue
    }
    postedCents += transaction.type === TransactionType.CREDIT ? cents : -cents
  }
  const overdraftCents = toCents(account.overdraftLimit.toNumber())
  return {
    currentBalance: postedCents / 100,
    availableBalance: (postedCents + overdraftCents - pendingDebitCents) / 100,
    pendingDebits: pendingDebitCents / 100,
    overdraftLimit: overdraftCents / 100,
  }
}
