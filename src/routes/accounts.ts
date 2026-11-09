import express, { type Request, type Response } from 'express'
import dayjs from 'dayjs'
const router = express.Router()
import { Prisma, PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import { formatResponse, formatErrorResponse, emitDatabaseSummary } from '../app.js'
import { Investec } from 'programmable-banking-faker'
import {
  CARD_TRANSACTION_TYPES,
  InvestecTransactionType,
  TransactionStatus,
  TransactionType,
  type BalanceResponse,
} from '../types.js'
import { getAccountBalance } from '../balance.js'
import { accountAllowed } from '../consent.js'

const INSUFFICIENT_FUNDS = 'Insufficient funds'

// Sum the amounts of a pay/transfer batch in cents, so the whole batch is
// checked against the available balance before anything is written.
function batchTotal(items: { amount: unknown }[]) {
  return items.reduce((cents, item) => cents + Math.round(Number(item.amount) * 100), 0) / 100
}

// A 3-legged token only reaches the accounts the user consented to. Every
// /:accountId route checks here first; other accounts get a 403.
router.param('accountId', (req, res, next, accountId: string) => {
  if (!accountAllowed(res, accountId)) {
    return formatErrorResponse(req, res, 403, 'Account not consented for this token')
  }
  next()
})

router.get('/', async (req: Request, res: Response) => {
  try {
    // overdraftLimit is sandbox-internal, so keep the list in the real API's
    // shape, and list only the accounts this token may see.
    const accounts = (await prisma.account.findMany())
      .filter(account => accountAllowed(res, account.accountId))
      .map(({ overdraftLimit: _overdraftLimit, ...account }) => account)
    const data = { accounts }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/:accountId/balance', async (req: Request, res: Response) => {
  try {
    const accountId = req.params.accountId
    const balance = await getAccountBalance(accountId)
    if (!balance) {
      return formatErrorResponse(req, res, 404) // no account was found
    }
    // currentBalance = posted transactions; availableBalance also counts the
    // overdraft limit and subtracts pending card holds.
    const data: BalanceResponse = {
      accountId,
      currentBalance: balance.currentBalance,
      availableBalance: balance.availableBalance,
      currency: 'ZAR',
    }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

type TransactionRow = Awaited<
  ReturnType<typeof prisma.transaction.findFirstOrThrow>
>

function toTransactionResponse(transaction: TransactionRow) {
  return {
    accountId: transaction.accountId,
    type: transaction.type,
    transactionType: transaction.transactionType,
    status: transaction.status,
    description: transaction.description,
    cardNumber: transaction.cardNumber,
    postedOrder: transaction.postedOrder,
    postingDate: transaction.postingDate,
    valueDate: transaction.valueDate,
    actionDate: transaction.actionDate,
    transactionDate: transaction.transactionDate,
    amount: transaction.amount,
    runningBalance: transaction.runningBalance,
  }
}

router.get('/:accountId/transactions', async (req: Request, res: Response) => {
  try {
    const accountId = req.params.accountId
    // check that the account exists
    const account = await prisma.account.findFirst({
      where: {
        accountId: accountId,
      },
    })
    if (!account) {
      console.log('no account found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    const transactionsArr = await prisma.transaction.findMany({
      where: {
        accountId: accountId,
      },
      // Oldest first, so postedOrder and runningBalance accumulate in posting
      // order even when a transaction was inserted backdated. transactionId
      // breaks ties within a day.
      orderBy: [{ postingDate: 'asc' }, { transactionId: 'asc' }],
    })
    //    console.log(transactionsArr)
    const toDate = req.query.toDate ?? dayjs().format('YYYY-MM-DD') // set to today
    const fromDate =
      req.query.fromDate ?? dayjs().subtract(180, 'day').format('YYYY-MM-DD') // set to 180 in the passed
    const transactionType = req.query.transactionType ?? null
    // Like the real API, pending transactions are only listed on request.
    const includePending = req.query.includePending === 'true'

    let postedOrder = 0
    let runningBalance: number = 0
    const transactions = []
    const pendingTransactions = []
    for (let j = 0; j < transactionsArr.length; j++) {
      const pending = transactionsArr[j].status === TransactionStatus.PENDING
      if (pending && !includePending) {
        continue
      }
      // Pending items have no posted order or running balance yet.
      if (pending) {
        if (
          transactionType !== null &&
          transactionsArr[j].transactionType !== transactionType
        ) {
          continue
        }
        const pendingDate = dayjs(transactionsArr[j].transactionDate)
        if (
          pendingDate.isBefore(fromDate as string, 'day') ||
          pendingDate.isAfter(toDate as string, 'day')
        ) {
          continue
        }
        pendingTransactions.push({
          ...toTransactionResponse(transactionsArr[j]),
          postedOrder: 0,
          runningBalance: 0,
        })
        continue
      }
      postedOrder++
      const amount = transactionsArr[j].amount.toNumber()
      if (transactionsArr[j].type === TransactionType.CREDIT) {
        runningBalance += amount
      } else {
        runningBalance -= amount
      }
      if (
        transactionType !== null &&
        transactionsArr[j].transactionType !== transactionType
      ) {
        continue
      }
      const transactionDate = dayjs(transactionsArr[j].postingDate)
      // compare both dates together
      if (transactionDate.isBefore(fromDate as string, 'day')) {
        continue
      }
      if (transactionDate.isAfter(toDate as string, 'day')) {
        continue
      }
      transactionsArr[j].postedOrder = new Prisma.Decimal(postedOrder)
      transactionsArr[j].runningBalance = new Prisma.Decimal(
        +runningBalance.toFixed(2),
      )
      transactions.push(toTransactionResponse(transactionsArr[j]))
    }
    // Like the real API, newest first, with pending holds (the most recent
    // activity) on top.
    const data = {
      transactions: [...pendingTransactions.reverse(), ...transactions.reverse()],
    }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// transfer multiple transactions
router.post('/:accountId/transfermultiple',
  async (req: Request, res: Response) => {
    try {
      const accountId = req.params.accountId
      // check that the account exists
      const account = await prisma.account.findFirst({
        where: {
          accountId: accountId,
        },
      })
      if (!account) {
        console.log('no account found')
        return formatErrorResponse(req, res, 404) // no account was found
      }
      const transfers = req.body.transferList
      if (!Array.isArray(transfers) || transfers.length === 0) {
        return formatErrorResponse(req, res, 400) // nothing to transfer
      }

      // Validate every leg and confirm each beneficiary account exists before
      // writing anything, so a bad entry can't leave a half-finished transfer.
      const writes: Prisma.PrismaPromise<unknown>[] = []
      for (const transfer of transfers) {
        const amount = Number(transfer.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
          return formatErrorResponse(req, res, 400) // invalid amount
        }
        // Both sides of a transfer must be accounts the token may touch.
        if (!accountAllowed(res, transfer.beneficiaryAccountId)) {
          return formatErrorResponse(req, res, 403, 'Account not consented for this token')
        }
        const beneficiary = await prisma.account.findFirst({
          where: {
            accountId: transfer.beneficiaryAccountId,
          },
        })
        if (!beneficiary) {
          console.log('no beneficiary account found')
          return formatErrorResponse(req, res, 404) // no account was found
        }
        const today = dayjs().format('YYYY-MM-DD')
        writes.push(
          prisma.transaction.create({
            data: {
              accountId: accountId,
              type: TransactionType.DEBIT,
              transactionType: InvestecTransactionType.OnlineBankingTransfers,
              status: 'POSTED',
              description: transfer.myReference,
              cardNumber: '',
              postedOrder: 0,
              postingDate: today,
              valueDate: today,
              actionDate: today,
              transactionDate: today,
              amount: transfer.amount,
              runningBalance: 0,
            },
          }),
          prisma.transaction.create({
            data: {
              accountId: transfer.beneficiaryAccountId,
              type: TransactionType.CREDIT,
              transactionType: InvestecTransactionType.OnlineBankingTransfers,
              status: 'POSTED',
              description: transfer.theirReference,
              cardNumber: '',
              postedOrder: 0,
              postingDate: today,
              valueDate: today,
              actionDate: today,
              transactionDate: today,
              amount: transfer.amount,
              runningBalance: 0,
            },
          }),
        )
      }

      // Every leg is valid; the whole batch must fit the available balance.
      const balance = await getAccountBalance(accountId)
      if (balance && batchTotal(transfers) > balance.availableBalance) {
        return formatErrorResponse(req, res, 422, INSUFFICIENT_FUNDS)
      }

      // Commit every leg atomically.
      await prisma.$transaction(writes)

      return formatResponse(transfers, req, res)
    } catch (error) {
      console.log(error)
      return formatErrorResponse(req, res, 500)
    }
  },
)

// beneficiary payment
router.post('/:accountId/paymultiple', async (req: Request, res: Response) => {
  try {
    const accountId = req.params.accountId
    // check that the account exists
    const account = await prisma.account.findFirst({
      where: {
        accountId: accountId,
      },
    })
    if (!account) {
      console.log('no account found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    const transfers = req.body.paymentList
    if (!Array.isArray(transfers) || transfers.length === 0) {
      return formatErrorResponse(req, res, 400) // nothing to pay
    }

    // Validate every payment and confirm each beneficiary exists before writing
    // anything, so a bad entry can't leave a half-finished batch.
    const writes: Prisma.PrismaPromise<unknown>[] = []
    for (const payment of transfers) {
      const amount = Number(payment.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return formatErrorResponse(req, res, 400) // invalid amount
      }
      const beneficiary = await prisma.beneficiary.findFirst({
        where: {
          beneficiaryId: payment.beneficiaryId,
        },
      })
      if (!beneficiary) {
        console.log('no beneficiary account found')
        return formatErrorResponse(req, res, 404) // no account was found
      }
      const today = dayjs().format('YYYY-MM-DD')
      writes.push(
        prisma.transaction.create({
          data: {
            accountId: accountId,
            type: TransactionType.DEBIT,
            transactionType: InvestecTransactionType.OnlineBankingPayments,
            status: 'POSTED',
            description: payment.myReference,
            cardNumber: '',
            postedOrder: 0,
            postingDate: today,
            valueDate: today,
            actionDate: today,
            transactionDate: today,
            amount: payment.amount,
            runningBalance: 0,
          },
        }),
        // The beneficiary remembers its most recent payment, in the same
        // formats the API uses (e.g. "2,000.00" and "25/04/2023").
        prisma.beneficiary.update({
          where: { beneficiaryId: payment.beneficiaryId },
          data: {
            lastPaymentAmount: amount.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            lastPaymentDate: dayjs().format('DD/MM/YYYY'),
          },
        }),
      )
    }

    // Every payment is valid; the whole batch must fit the available balance.
    const balance = await getAccountBalance(accountId)
    if (balance && batchTotal(transfers) > balance.availableBalance) {
      return formatErrorResponse(req, res, 422, INSUFFICIENT_FUNDS)
    }

    // Commit every payment atomically.
    await prisma.$transaction(writes)

    return formatResponse(transfers, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// function to create transactions for an account
router.post('/:accountId/transactions', async (req: Request, res: Response) => {
  try {
    let randomTx = Investec.transaction(req.params.accountId)
    // A pending transaction is usually a card hold: default its type to a
    // card purchase rather than a random one, and refuse non-card types
    // unless the caller opts in with ?allowNonCardPending=true (for the rare
    // non-card pending case, e.g. a held EFT).
    if (req.body.status === TransactionStatus.PENDING) {
      randomTx.transactionType = InvestecTransactionType.CardPurchases
    }
    randomTx = { ...randomTx, ...req.body }
    const allowNonCardPending = req.query.allowNonCardPending === 'true'
    if (
      randomTx.status === TransactionStatus.PENDING &&
      !allowNonCardPending &&
      !CARD_TRANSACTION_TYPES.includes(randomTx.transactionType)
    ) {
      return formatErrorResponse(
        req,
        res,
        400,
        'Only card transactions can be pending',
      )
    }

    const accountId = req.params.accountId
    // check that the account exists
    const account = await prisma.account.findFirst({
      where: {
        accountId: accountId,
      },
    })
    if (!account) {
      console.log('no account found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    // insert the transaction
    const transaction = await prisma.transaction.create({
      data: randomTx,
    })
    await emitDatabaseSummary()
    return formatResponse(transaction, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// Sandbox convenience: top up an account's balance with a single CREDIT.
// Not a real Investec endpoint — it makes "add money to this account" a
// one-call action instead of hand-crafting a transaction.
router.post('/:accountId/topup', async (req: Request, res: Response) => {
  try {
    const accountId = req.params.accountId
    const amount = Number(req.body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return formatErrorResponse(req, res, 400) // invalid amount
    }
    // check that the account exists
    const account = await prisma.account.findFirst({
      where: {
        accountId: accountId,
      },
    })
    if (!account) {
      console.log('no account found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    const today = dayjs().format('YYYY-MM-DD')
    const transaction = await prisma.transaction.create({
      data: {
        accountId: accountId,
        type: TransactionType.CREDIT,
        transactionType: InvestecTransactionType.Deposits,
        status: 'POSTED',
        description: req.body.description ?? 'Sandbox top up',
        cardNumber: '',
        postedOrder: 0,
        postingDate: today,
        valueDate: today,
        actionDate: today,
        transactionDate: today,
        amount: amount,
        runningBalance: 0,
      },
    })
    await emitDatabaseSummary()
    return formatResponse(transaction, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// Sandbox convenience: settle an account's pending transactions (flip them to
// POSTED), simulating the pending → posted lifecycle for scenario testing.
router.post('/:accountId/transactions/settle', async (req: Request, res: Response) => {
  try {
    const accountId = req.params.accountId
    const account = await prisma.account.findFirst({
      where: {
        accountId: accountId,
      },
    })
    if (!account) {
      console.log('no account found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    // Card holds have no posting date until they settle: they post today.
    // Pending items created with explicit dates keep them.
    const today = dayjs().format('YYYY-MM-DD')
    const [, result] = await prisma.$transaction([
      prisma.transaction.updateMany({
        where: {
          accountId: accountId,
          status: TransactionStatus.PENDING,
          postingDate: '',
        },
        data: { postingDate: today, valueDate: today, actionDate: today },
      }),
      prisma.transaction.updateMany({
        where: {
          accountId: accountId,
          status: TransactionStatus.PENDING,
        },
        data: { status: TransactionStatus.POSTED },
      }),
    ])
    await emitDatabaseSummary()
    return formatResponse({ settled: result.count }, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})


router.delete('/:accountId/transactions/:postingDate',
  async (req: Request, res: Response) => {
    try {
      const accountId = req.params.accountId
      const postingDate = req.params.postingDate
      // check that the account exists
      const account = await prisma.account.findFirst({
        where: {
          accountId: accountId,
        },
      })
      if (!account) {
        console.log('no account found')
        return formatErrorResponse(req, res, 404) // no account was found
      }
      // delete the transactions
      await prisma.transaction.deleteMany({
        where: {
          accountId: accountId,
          postingDate: postingDate,
        },
      })
      await emitDatabaseSummary()

      return res.status(200).json()
    } catch (error) {
      console.log(error)
      return formatErrorResponse(req, res, 500)
    }
  },
)

// function to create an account
router.post('/', async (req: Request, res: Response) => {
  try {
    const baseAccount = Investec.account()
    
    // Get the default profile (or first available profile)
    const defaultProfile = await prisma.profile.findFirst()
    if (!defaultProfile) {
      console.log('No profile found. Please seed the database first.')
      return formatErrorResponse(req, res, 500)
    }
    
    const account = { 
      ...baseAccount,
      profileId: defaultProfile.profileId,
      profileName: defaultProfile.profileName,
      kycCompliant: true,
      ...req.body 
    }
    // check that the account exists
    const accountcheck = await prisma.account.findFirst({
      where: {
        accountId: account.accountId,
      },
    })
    if (accountcheck) {
      console.log('account found')
      return formatErrorResponse(req, res, 409) // account was found
    }
    // insert the transaction
    await prisma.account.create({
      data: account,
    })
    await emitDatabaseSummary()

    return formatResponse(account, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// function to delete an account
router.delete('/:accountId', async (req: Request, res: Response) => {
  try {
    const accountId = req.params.accountId
    // check that the account exists
    const account = await prisma.account.findFirst({
      where: {
        accountId: accountId,
      },
    })
    if (!account) {
      console.log('no account found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    // Remove the account's cards and their code rows. Deleting a card
    // cascades its executions and logs; the code rows have no FK link, so
    // they are gathered and removed explicitly.
    const cards = await prisma.card.findMany({
      where: { accountId: accountId },
    })
    const codeIds = cards
      .flatMap(card => [card.savedCode, card.publishedCode])
      .filter(Boolean)

    await prisma.card.deleteMany({
      where: { accountId: accountId },
    })
    if (codeIds.length > 0) {
      await prisma.cardCode.deleteMany({
        where: { codeId: { in: codeIds } },
      })
    }

    // Deleting the account cascades its transactions.
    await prisma.account.delete({
      where: {
        accountId: accountId,
      },
    })
    await emitDatabaseSummary()

    return res.status(200).json()
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/beneficiaries', async (req: Request, res: Response) => {
  try {
    const result = await prisma.beneficiary.findMany()
    const data = { result }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.post('/beneficiaries', async (req: Request, res: Response) => {
  try {
    let beneficiary = Investec.beneficiary()
    beneficiary = { ...beneficiary, ...req.body }

    const existing = await prisma.beneficiary.findUnique({
      where: { beneficiaryId: beneficiary.beneficiaryId },
    })
    if (existing) {
      return formatErrorResponse(req, res, 409)
    }

    await prisma.beneficiary.create({ data: beneficiary })
    return formatResponse(beneficiary, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// Delete a beneficiary
router.delete('/beneficiaries/:beneficiaryId', async (req: Request, res: Response) => {
  try {
    const { beneficiaryId } = req.params

    // Check if beneficiary exists
    const existingBeneficiary = await prisma.beneficiary.findUnique({
      where: { beneficiaryId },
    })

    if (!existingBeneficiary) {
      return formatErrorResponse(req, res, 404)
    }

    // Delete the beneficiary
    await prisma.beneficiary.delete({
      where: { beneficiaryId },
    })

    // Emit database summary update for real-time dashboard
    await emitDatabaseSummary()

    return res.status(200).json({})
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// Pending transactions (card holds that have not settled yet), with the
// reduced set of fields the real pending-transactions endpoint returns.
// transactionId is a sandbox addition so a hold can be settled or reversed.
router.get('/:accountId/pending-transactions', async (req: Request, res: Response) => {
  try {
    const accountId = req.params.accountId
    const account = await prisma.account.findFirst({ where: { accountId } })
    if (!account) {
      return formatErrorResponse(req, res, 404)
    }
    const pending = await prisma.transaction.findMany({
      where: { accountId, status: TransactionStatus.PENDING },
      orderBy: { transactionId: 'asc' },
    })
    const pendingTransactions = pending.map(transaction => ({
      transactionId: transaction.transactionId,
      accountId: transaction.accountId,
      type: transaction.type,
      transactionType: transaction.transactionType,
      status: transaction.status,
      description: transaction.description,
      cardNumber: transaction.cardNumber,
      transactionDate: transaction.transactionDate,
      amount: transaction.amount,
    }))
    return formatResponse({ pendingTransactions }, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// Find one pending transaction on an account, or null.
async function findPending(accountId: string, transactionId: string) {
  const id = Number(transactionId)
  if (!Number.isInteger(id)) {
    return null
  }
  return prisma.transaction.findFirst({
    where: { transactionId: id, accountId, status: TransactionStatus.PENDING },
  })
}

// Sandbox control: settle a pending transaction so it posts today and counts
// towards the current balance. Not a real Investec endpoint.
router.post(
  '/:accountId/pending-transactions/:transactionId/settle',
  async (req: Request, res: Response) => {
    try {
      const { accountId, transactionId } = req.params
      const pending = await findPending(accountId, transactionId)
      if (!pending) {
        return formatErrorResponse(req, res, 404)
      }
      const today = dayjs().format('YYYY-MM-DD')
      const transaction = await prisma.transaction.update({
        where: { transactionId: pending.transactionId },
        data: {
          status: TransactionStatus.POSTED,
          postingDate: today,
          valueDate: today,
          actionDate: today,
        },
      })
      await emitDatabaseSummary()
      return formatResponse(toTransactionResponse(transaction), req, res)
    } catch (error) {
      console.log(error)
      return formatErrorResponse(req, res, 500)
    }
  },
)

// Sandbox control: reverse (drop) a pending hold, releasing the funds.
// Not a real Investec endpoint.
router.delete(
  '/:accountId/pending-transactions/:transactionId',
  async (req: Request, res: Response) => {
    try {
      const { accountId, transactionId } = req.params
      const pending = await findPending(accountId, transactionId)
      if (!pending) {
        return formatErrorResponse(req, res, 404)
      }
      await prisma.transaction.delete({
        where: { transactionId: pending.transactionId },
      })
      await emitDatabaseSummary()
      return res.status(200).json({})
    } catch (error) {
      console.log(error)
      return formatErrorResponse(req, res, 500)
    }
  },
)

// Fixed reference data: the categories a beneficiary can be filed under.
const beneficiaryCategories = [
  { categoryId: '10189603223001', isDefault: true, name: 'Default' },
  { categoryId: '10189603223002', isDefault: false, name: 'Family' },
  { categoryId: '10189603223003', isDefault: false, name: 'Friends' },
  { categoryId: '10189603223004', isDefault: false, name: 'Businesses' },
]

router.get('/beneficiarycategories', (req: Request, res: Response) => {
  return formatResponse(beneficiaryCategories, req, res)
})

// Build a list of recent monthly statement documents for an account.
function statementDocuments() {
  const documents = []
  for (let i = 1; i <= 3; i++) {
    const month = dayjs().subtract(i, 'month')
    documents.push({
      documentType: 'Statement',
      documentDate: month.endOf('month').format('YYYY-MM-DD'),
      description: `Monthly statement — ${month.format('MMMM YYYY')}`,
    })
  }
  return documents
}

// List the documents (statements) available for an account.
router.get('/:accountId/documents', async (req: Request, res: Response) => {
  try {
    const accountId = req.params.accountId
    const account = await prisma.account.findFirst({
      where: { accountId: accountId },
    })
    if (!account) {
      return formatErrorResponse(req, res, 404)
    }
    return formatResponse({ documents: statementDocuments() }, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// Fetch a specific document. The sandbox returns a placeholder descriptor
// rather than a real statement file.
router.get(
  '/:accountId/documents/:documentType/:documentDate',
  async (req: Request, res: Response) => {
    try {
      const { accountId, documentType, documentDate } = req.params
      const account = await prisma.account.findFirst({
        where: { accountId: accountId },
      })
      if (!account) {
        return formatErrorResponse(req, res, 404)
      }
      const document = {
        accountId: accountId,
        documentType: documentType,
        documentDate: documentDate,
        fileName: `${documentType}-${documentDate}.pdf`,
        mimeType: 'application/pdf',
        note: 'Sandbox placeholder document — no real statement is generated.',
      }
      return formatResponse(document, req, res)
    } catch (error) {
      console.log(error)
      return formatErrorResponse(req, res, 500)
    }
  },
)

export default router
