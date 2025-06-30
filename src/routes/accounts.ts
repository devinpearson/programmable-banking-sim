import express, { Request, Response } from 'express'
import dayjs from 'dayjs'
const router = express.Router()
import { Prisma } from '@prisma/client'
import { formatResponse, formatErrorResponse } from '../app.js'
import { Investec } from 'programmable-banking-faker'
import { TransactionType, BalanceResponse } from '../types.js'
import { createAccount, createBeneficiary, createTransaction, deleteAccount, deleteTransactions, deleteTransactionsByDate, getAccount, getAccounts, getBeneficiaries, getBeneficiary, getTransactions } from '../db.js'

router.get('/', async (req: Request, res: Response) => {
  try {
    const accounts = await getAccounts()
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
    if (!accountId) {
        return formatErrorResponse(req, res, 400) // bad request
      }
    const account = await getAccount(accountId)
    if (!account) {
      return formatErrorResponse(req, res, 404) // no account was found
    }

    
    const transactionsArr = await getTransactions(accountId)
    let runningBalance = 0

    for (let j = 0; j < transactionsArr.length; j++) {
        const transactionInner = transactionsArr[j]
      if (!transactionInner) continue;
      const amount = transactionInner.amount.toNumber()
      if (transactionInner.type === TransactionType.CREDIT) {
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
    if (!accountId) {
        return formatErrorResponse(req, res, 404) // no account was found
    }
    // check that the account exists
    const account = await getAccount(accountId)
    if (!account) {
      console.log('no account found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    const transactionsArr = await getTransactions(accountId)
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
        const transactionInner = transactionsArr[j]
        if (!transactionInner) continue
        const amount = transactionInner.amount.toNumber()
        if (transactionsArr[j]?.type === TransactionType.CREDIT) {
            runningBalance += amount
        } else {
            runningBalance -= amount
        }
        if (
            transactionType !== null &&
            transactionInner.transactionType !== transactionType
        ) {
            continue
        }
        const transactionDate = dayjs(transactionInner.postingDate)
        // compare both dates together
        if (transactionDate.isBefore(fromDate as string, 'day')) {
            continue
        }
        if (transactionDate.isAfter(toDate as string, 'day')) {
            continue
        }
        transactionInner.postedOrder = new Prisma.Decimal(postedOrder)
        transactionInner.runningBalance = new Prisma.Decimal(
            +runningBalance.toFixed(2),
        )
        transactions.push({
            accountId: transactionInner.accountId,
            type: transactionInner.type,
            transactionType: transactionInner.transactionType,
            status: transactionInner.status,
            description: transactionInner.description,
            cardNumber: transactionInner.cardNumber,
            postedOrder: transactionInner.postedOrder,
            postingDate: transactionInner.postingDate,
            valueDate: transactionInner.valueDate,
            actionDate: transactionInner.actionDate,
            transactionDate: transactionInner.transactionDate,
            amount: transactionInner.amount,
            runningBalance: transactionInner.runningBalance,
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
      if (!accountId) {
        return formatErrorResponse(req, res, 404) // no account was found
        }
      // check that the account exists
      const account = await getAccount(accountId)
      if (!account) {
        console.log('no account found')
        return formatErrorResponse(req, res, 404) // no account was found
      }
      const transfers = req.body.transferList
      console.log(transfers)
      for (let i = 0; i < transfers.length; i++) {
        const beneficiary = await getAccount(transfers[i].beneficiaryAccountId)
        if (!beneficiary) {
          console.log('no beneficiary account found')
          return formatErrorResponse(req, res, 404) // no account was found
        }
        // insert the transaction
        await createTransaction({
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
          })

          await createTransaction({
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
    if (!accountId) {
        return formatErrorResponse(req, res, 404) // no account was found
    }
    // check that the account exists
    const account = await getAccount(accountId)
    if (!account) {
      console.log('no account found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    const transfers = req.body.paymentList
    // console.log(transfers)
    for (let i = 0; i < transfers.length; i++) {
      const beneficiary = await getBeneficiary(transfers[i].beneficiaryId)
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
      await createTransaction({
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
    const accountId = req.params.account
    if (!accountId) {
        return formatErrorResponse(req, res, 404) // no account was found
    }
    let randomTx = Investec.transaction(accountId)
    randomTx = { ...randomTx, ...req.body }

    // check that the account exists
    const account = await getAccount(accountId)
    if (!account) {
      console.log('no account found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    // insert the transaction
    const transaction = await createTransaction(randomTx)
    return formatResponse(transaction, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.post('/:accountId/transactions', async (req: Request, res: Response) => {
  try {
    const accountId = req.params.accountId
    if (!accountId) {
        return formatErrorResponse(req, res, 404) // no account was found
    }
    let randomTx = Investec.transaction(accountId)
    randomTx.runningBalance = 0
    randomTx = { ...randomTx, ...req.body }
    // check that the account exists
    const account = await getAccount(accountId)
    if (!account) {
      console.log('no account found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    // insert the transaction
    const transaction = await createTransaction(randomTx)
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
        if (!accountId) {
            return formatErrorResponse(req, res, 404) // no account was found
        }
      const postingDate = req.params.postingDate
      if (!postingDate) {
        return formatErrorResponse(req, res, 422) // no account was found
    }
      // check that the account exists
      const account = await getAccount(accountId)
      if (!account) {
        console.log('no account found')
        return formatErrorResponse(req, res, 404) // no account was found
      }
      // delete the transactions
      await deleteTransactionsByDate(accountId, postingDate)

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
    const accountcheck = await getAccount(account.accountId)
    if (accountcheck) {
      console.log('account found')
      return formatErrorResponse(req, res, 409) // account was found
    }
    // insert the transaction
    await createAccount(account)

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
    if (!accountId) {
        return formatErrorResponse(req, res, 404) // no account was found
    }
    // check that the account exists
    const account = await getAccount(accountId)
    if (!account) {
      console.log('no account found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    // remove the transactions
    await deleteTransactions(accountId)
    await deleteAccount(accountId)

    return res.status(200).json()
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/beneficiaries', async (req: Request, res: Response) => {
  try {
    const result = await getBeneficiaries()
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
    await createBeneficiary(beneficiary)

    return formatResponse(beneficiary, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

export default router
