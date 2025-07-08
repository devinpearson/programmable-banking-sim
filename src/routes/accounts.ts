import express, { Request, Response } from 'express'
import dayjs from 'dayjs'
const router = express.Router()
import { Prisma, PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import { formatResponse, formatErrorResponse, emitDatabaseSummary } from '../app.js'
import { Investec } from 'programmable-banking-faker'
import { TransactionType, BalanceResponse } from '../types.js'

router.get('/', async (req: Request, res: Response) => {
  try {
    const accounts = await prisma.account.findMany()
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

    const account = await prisma.account.findFirst({
      where: {
        accountId: accountId,
      },
    })
    if (!account) {
      return formatErrorResponse(req, res, 404) // no account was found
    }

    const transactionsArr = await prisma.transaction.findMany({
      where: {
        accountId: accountId,
      },
    })
    let runningBalance = 0

    for (let j = 0; j < transactionsArr.length; j++) {
      const amount = transactionsArr[j].amount.toNumber()
      if (transactionsArr[j].type === TransactionType.CREDIT) {
        runningBalance += amount
      } else {
        runningBalance -= amount
      }
    }

    const balance = runningBalance.toFixed(2)
    // overdraft - balance // workout over
    // fetch the currentBalance and availableBalance from the transactions table
    const data: BalanceResponse = {
      accountId,
      currentBalance: +balance,
      availableBalance: 0,
      currency: 'ZAR',
    }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

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
    })
    //    console.log(transactionsArr)
    const toDate = req.query.toDate ?? dayjs().format('YYYY-MM-DD') // set to today
    const fromDate =
      req.query.fromDate ?? dayjs().subtract(180, 'day').format('YYYY-MM-DD') // set to 180 in the passed
    const transactionType = req.query.transactionType ?? null

    let postedOrder = 0
    let runningBalance: number = 0
    const transactions = []
    for (let j = 0; j < transactionsArr.length; j++) {
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
      transactions.push({
        accountId: transactionsArr[j].accountId,
        type: transactionsArr[j].type,
        transactionType: transactionsArr[j].transactionType,
        status: transactionsArr[j].status,
        description: transactionsArr[j].description,
        cardNumber: transactionsArr[j].cardNumber,
        postedOrder: transactionsArr[j].postedOrder,
        postingDate: transactionsArr[j].postingDate,
        valueDate: transactionsArr[j].valueDate,
        actionDate: transactionsArr[j].actionDate,
        transactionDate: transactionsArr[j].transactionDate,
        amount: transactionsArr[j].amount,
        runningBalance: transactionsArr[j].runningBalance,
      })
    }
    const data = { transactions }
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
      console.log(transfers)
      for (let i = 0; i < transfers.length; i++) {
        const beneficiary = await prisma.account.findFirst({
          where: {
            accountId: transfers[i].beneficiaryAccountId,
          },
        })
        if (!beneficiary) {
          console.log('no beneficiary account found')
          return formatErrorResponse(req, res, 404) // no account was found
        }
        const transactionOut = {
          accountId: accountId,
          type: TransactionType.DEBIT,
          transactionType: 'Transfer',
          status: 'POSTED',
          description: transfers[i].myReference,
          cardNumber: '',
          postedOrder: 0,
          postingDate: dayjs().format('YYYY-MM-DD'),
          valueDate: dayjs().format('YYYY-MM-DD'),
          actionDate: dayjs().format('YYYY-MM-DD'),
          transactionDate: dayjs().format('YYYY-MM-DD'),
          amount: transfers[i].amount,
          runningBalance: 0,
        }
        // insert the transaction
        await prisma.transaction.create({
          data: transactionOut,
        })

        const transactionIn = {
          accountId: transfers[i].beneficiaryAccountId,
          type: TransactionType.CREDIT,
          transactionType: 'Transfer',
          status: 'POSTED',
          description: transfers[i].theirReference,
          cardNumber: '',
          postedOrder: 0,
          postingDate: dayjs().format('YYYY-MM-DD'),
          valueDate: dayjs().format('YYYY-MM-DD'),
          actionDate: dayjs().format('YYYY-MM-DD'),
          transactionDate: dayjs().format('YYYY-MM-DD'),
          amount: transfers[i].amount,
          runningBalance: 0,
        }
        // insert the transaction
        await prisma.transaction.create({
          data: transactionIn,
        })
      }

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
    // console.log(transfers)
    for (let i = 0; i < transfers.length; i++) {
      const beneficiary = await prisma.beneficiary.findFirst({
        where: {
          beneficiaryId: transfers[i].beneficiaryId,
        },
      })
      if (!beneficiary) {
        console.log('no beneficiary account found')
        return formatErrorResponse(req, res, 404) // no account was found
      }
      const transactionOut = {
        accountId: accountId,
        type: TransactionType.DEBIT,
        transactionType: 'Transfer',
        status: 'POSTED',
        description: transfers[i].myReference,
        cardNumber: '',
        postedOrder: 0,
        postingDate: dayjs().format('YYYY-MM-DD'),
        valueDate: dayjs().format('YYYY-MM-DD'),
        actionDate: dayjs().format('YYYY-MM-DD'),
        transactionDate: dayjs().format('YYYY-MM-DD'),
        amount: transfers[i].amount,
        runningBalance: 0,
      }
      // insert the transaction
      await prisma.transaction.create({
        data: transactionOut,
      })
    }

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
    randomTx = { ...randomTx, ...req.body }

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

router.post('/:accountId/transactions', async (req: Request, res: Response) => {
  try {
    let randomTx = Investec.transaction(req.params.accountId)
    randomTx.runningBalance = 0
    randomTx = { ...randomTx, ...req.body }

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
    return formatResponse(transaction, req, res)
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
    let account = Investec.account()
    account = { ...account, ...req.body }
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
    // remove the transactions
    await prisma.transaction.deleteMany({
      where: {
        accountId: accountId,
      },
    })
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

// function to create an account
router.post('/beneficiaries', async (req: Request, res: Response) => {
  try {
    let beneficiary = Investec.beneficiary()
    beneficiary = { ...beneficiary, ...req.body }

    // insert the beneficiary
    await prisma.beneficiary.create({
      data: beneficiary,
    })

    return formatResponse(beneficiary, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

export default router
