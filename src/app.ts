import express, { Request, Response } from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import dotenv from 'dotenv'
import { Prisma, PrismaClient } from '@prisma/client'

dotenv.config()

export const port = process.env.PORT || 3000
const envClientId = process.env.CLIENT_ID
const envClientSecret = process.env.CLIENT_SECRET
const envApiKey = process.env.API_KEY
const envTokenExpiry = process.env.TOKEN_EXPIRY || 1800
const envAuth = process.env.AUTH
const dbFile = process.env.DB_FILE || 'investec.db'
// const overdraft = process.env.OVERDRAFT || 5000
const prisma = new PrismaClient()
export const app = express()

const generator = require('./generate')


// for (let i = 0; i < 100; i++) {
//   const account = generator.randomBeneficiary()
//   database.insertBeneficiary(db, account)
// }

// for (let i = 0; i < 900; i++) {
//   const account = generator.randomTransaction('4675778129910189600000003')
//   database.insertTransaction(db, account)
// }

app.use(cors())
// Configuring body parser middleware
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

// enum scopes {
//     accounts = 'accounts',
//     transactions = 'transactions',
//     beneficiaries = 'beneficiaries',
//     cards = 'cards'
// }

interface AccessToken {
    expires_at: string
    scope: string
}

let accessTokens = {} as Record<string, AccessToken>

app.post('/identity/v2/oauth2/token', (req: Request, res: Response) => {
const authStr = Buffer.from((req.headers.authorization ?? '').split(' ')[1], 'base64').toString()
const [clientId, clientSecret] = authStr.split(':')

if (envClientId !== '' && envClientSecret !== '') {
    if (clientId !== envClientId || clientSecret !== envClientSecret) {
        return res.status(401).json()
    }
}
if (envApiKey !== '' && req.headers['x-api-key'] !== envApiKey) {
    return res.status(401).json()
}
// Generate a token string
const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
const expiryDate = dayjs().add(envTokenExpiry as number, 'seconds').format()
accessTokens[token] = { expires_at: expiryDate, scope: 'accounts' }
  return res.json({ access_token: token, token_type: 'Bearer', expires_in: envTokenExpiry, scope: 'accounts' })
})

function isValidToken (req: Request) {
    if (envAuth !== 'true') {
        return true
    }
    if (!req.get('authorization')) {
        return false
    }
    const authorization = req.get('authorization')?.split(' ')[1]
    if (!authorization) {
        return false
    }
    if (accessTokens[authorization] && dayjs().isBefore(accessTokens[authorization].expires_at)) {
        return true
    }

    return false
}

app.get('/za/pb/v1/accounts', async (req: Request, res: Response) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }

  const accounts = await prisma.account.findMany()
  const data = { accounts }
  return formatResponse(data, req, res)
})

app.get('/za/pb/v1/accounts/:accountId/balance', async (req: Request, res: Response) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const accountId = req.params.accountId

  const account = await prisma.account.findFirst({
    where: {
      accountId: accountId
    }
  })
  if (!account) {
    return res.status(404).json() // no account was found
  }

const transactionsArr = await prisma.transaction.findMany({
    where: {
      accountId: accountId
    }
  })
    let runningBalance = 0
    
    for (let j = 0; j < transactionsArr.length; j++) {
        let amount = transactionsArr[j].amount.toNumber()
        if (transactionsArr[j].type === 'CREDIT') {
            runningBalance += amount
        } else {
            runningBalance -= amount
        }
    }

    const balance =  runningBalance.toFixed(2)
  // overdraft - balance // workout over
  // fetch the currentBalance and availableBalance from the transactions table
  const data = {
    accountId,
    currentBalance: +balance,
    availableBalance: 0,
    currency: 'ZAR'
  }
  return formatResponse(data, req, res)
})

app.get('/za/pb/v1/accounts/:accountId/transactions', async (req: Request, res: Response) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const accountId = req.params.accountId
  // check that the account exists
  const account = await prisma.account.findFirst({
    where: {
      accountId: accountId
    }
  })
  if (!account) {
    console.log('no account found')
    return res.status(404).json() // no account was found
  }
  const transactionsArr = await prisma.transaction.findMany({
    where: {
      accountId: accountId
    }
  })
//    console.log(transactionsArr)
  const toDate = req.query.toDate ?? dayjs().format('YYYY-MM-DD') // set to today
  const fromDate = req.query.fromDate ?? dayjs().subtract(180, 'day').format('YYYY-MM-DD') // set to 180 in the passed
  const transactionType = req.query.transactionType ?? null

  let postedOrder = 0
  let runningBalance: number = 0
  let transactions = []
  for (let j = 0; j < transactionsArr.length; j++) {
    postedOrder++
    let amount = transactionsArr[j].amount.toNumber()
    if (transactionsArr[j].type === 'CREDIT') {
      runningBalance += amount
    } else {
      runningBalance -= amount
    }
    if (transactionType !== null && transactionsArr[j].transactionType !== transactionType) {
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
    transactionsArr[j].runningBalance = new Prisma.Decimal(+runningBalance.toFixed(2))
    transactions.push({
        "accountId": transactionsArr[j].accountId,
        "type": transactionsArr[j].type,
        "transactionType": transactionsArr[j].transactionType,
        "status": transactionsArr[j].status,
        "description": transactionsArr[j].description,
        "cardNumber": transactionsArr[j].cardNumber,
        "postedOrder": transactionsArr[j].postedOrder,
        "postingDate": transactionsArr[j].postingDate,
        "valueDate": transactionsArr[j].valueDate,
        "actionDate": transactionsArr[j].actionDate,
        "transactionDate": transactionsArr[j].transactionDate,
        "amount": transactionsArr[j].amount,
        "runningBalance": transactionsArr[j].runningBalance
    })
  }
  const data = { transactions }
  return formatResponse(data, req, res)
})

// transfer multiple transactions
app.post('/za/pb/v1/accounts/:accountId/transfermultiple', async (req: Request, res: Response) => {
    const accountId = req.params.accountId
    // check that the account exists
    const account = await prisma.account.findFirst({
      where: {
        accountId: accountId
      }
    })
    if (!account) {
      console.log('no account found')
      return res.status(404).json() // no account was found
    }
    let transfers = req.body.transferList
    console.log(transfers)
    for (let i = 0; i < transfers.length; i++) {
        const beneficiary = await prisma.account.findFirst({
            where: {
              accountId: transfers[i].beneficiaryAccountId
            }
          })
          if (!beneficiary) {
            console.log('no beneficiary account found')
            return res.status(404).json() // no account was found
          }
          let transactionOut =
            {
                accountId: accountId,
                type: 'DEBIT',
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
                runningBalance: 0
            }
        // insert the transaction
        const transaction = await prisma.transaction.create({
          data: transactionOut
        })

        let transactionIn =
            {
                accountId: transfers[i].beneficiaryAccountId,
                type: 'CREDIT',
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
                runningBalance: 0
            }
        // insert the transaction
        const transaction2 = await prisma.transaction.create({
          data: transactionIn
        })
    }

    return formatResponse(transfers, req, res)
  })

  // beneficiary payment
app.post('/za/pb/v1/accounts/:accountId/paymultiple', async (req: Request, res: Response) => {
    const accountId = req.params.accountId
    // check that the account exists
    const account = await prisma.account.findFirst({
      where: {
        accountId: accountId
      }
    })
    if (!account) {
      console.log('no account found')
      return res.status(404).json() // no account was found
    }
    let transfers = req.body.paymentList
    // console.log(transfers)
    for (let i = 0; i < transfers.length; i++) {
        const beneficiary = await prisma.beneficiary.findFirst({
            where: {
              beneficiaryId: transfers[i].beneficiaryId
            }
          })
          if (!beneficiary) {
            console.log('no beneficiary account found')
            return res.status(404).json() // no account was found
          }
          let transactionOut =
            {
                accountId: accountId,
                type: 'DEBIT',
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
                runningBalance: 0
            }
        // insert the transaction
        const transaction = await prisma.transaction.create({
          data: transactionOut
        })
    }

    return formatResponse(transfers, req, res)
  })
// function to create transactions for an account
app.post('/za/pb/v1/accounts/:accountId/transactions', async (req: Request, res: Response) => {
  let randomTransaction = generator.randomTransaction(req.params.accountId)
  randomTransaction.runningBalance = 0
  randomTransaction = { ...randomTransaction, ...req.body }

  const accountId = req.params.accountId
  // check that the account exists
  const account = await prisma.account.findFirst({
    where: {
      accountId: accountId
    }
  })
  if (!account) {
    console.log('no account found')
    return res.status(404).json() // no account was found
  }
  // insert the transaction
  const transaction = await prisma.transaction.create({
    data: randomTransaction
  })
  return formatResponse(transaction, req, res)
})

app.post('/za/pb/v1/accounts/:accountId/transactions', async (req: Request, res: Response) => {
    let randomTransaction = generator.randomTransaction(req.params.accountId)
    randomTransaction.runningBalance = 0
    randomTransaction = { ...randomTransaction, ...req.body }
  
    const accountId = req.params.accountId
    // check that the account exists
    const account = await prisma.account.findFirst({
      where: {
        accountId: accountId
      }
    })
    if (!account) {
      console.log('no account found')
      return res.status(404).json() // no account was found
    }
    // insert the transaction
    const transaction = await prisma.transaction.create({
      data: randomTransaction
    })
    return formatResponse(transaction, req, res)
  })

app.delete('/za/pb/v1/accounts/:accountId/transactions/:postingDate', async (req: Request, res: Response) => {
  const accountId = req.params.accountId
  const postingDate = req.params.postingDate
  // check that the account exists
  const account = await prisma.account.findFirst({
    where: {
      accountId: accountId
    }
  })
  if (!account) {
    console.log('no account found')
    return res.status(404).json() // no account was found
  }
  // delete the transactions
  const transactionsArr = await prisma.transaction.deleteMany({
    where: {
      accountId: accountId,
      postingDate: postingDate
    }
  })
  
  return res.status(200).json()
})

// function to create an account
app.post('/za/pb/v1/accounts', async (req: Request, res: Response) => {
  let account = generator.randomAccount()
  account = { ...account, ...req.body }
  // check that the account exists
  const accountcheck = await prisma.account.findFirst({
    where: {
      accountId: account.accountId
    }
  })
  if (accountcheck) {
    console.log('account found')
    return res.status(409).json() // account was found
  }
  // insert the transaction
  await prisma.account.create({
    data: account
  })

  return formatResponse(account, req, res)
})

// function to delete an account
app.delete('/za/pb/v1/accounts/:accountId', async (req: Request, res: Response) => {
  const accountId = req.params.accountId
  // check that the account exists
  const account = await prisma.account.findFirst({
    where: {
      accountId: accountId
    }
  })
  if (!account) {
    console.log('no account found')
    return res.status(404).json() // no account was found
  }
  // remove the transactions
  await prisma.transaction.deleteMany({
    where: {
      accountId: accountId,
    }
  })
    await prisma.account.delete({
        where: {
        accountId: accountId
        }
    })

  return res.status(200).json()
})

app.get('/za/pb/v1/accounts/beneficiaries', async (req: Request, res: Response) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const result = await prisma.beneficiary.findMany()
  const data = { result }
  return formatResponse(data, req, res)
})

// function to create an account
app.post('/za/pb/v1/accounts/beneficiaries', async (req: Request, res: Response) => {
  let beneficiary = generator.randomBeneficiary()
  beneficiary = { ...beneficiary, ...req.body }
  // check that the account exists
  const account = await prisma.account.findFirst({
    where: {
      accountId: beneficiary.accountId
    }
  })
  if (!account) {
    console.log('no account found')
    return res.status(404).json() // no account was found
  }
  // insert the transaction
  await prisma.beneficiary.create({
    data: beneficiary
  })

  return formatResponse(beneficiary, req, res)
})

app.get('/za/v1/cards/countries', async (req: Request, res: Response) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const result = await prisma.country.findMany()
  const data = { result }
  return formatResponse(data, req, res)
})

app.get('/za/v1/cards/currencies', async (req: Request, res: Response) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const result = await prisma.currency.findMany()
  const data = { result }
  return formatResponse(data, req, res)
})

app.get('/za/v1/cards/merchants', async (req: Request, res: Response) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const result = await prisma.merchant.findMany()
  const data = { result }
  return formatResponse(data, req, res)
})

const formatResponse = (data: any, req: Request, res: Response) => {
  return res.json({
    data,
    links: {
      self: req.protocol + '://' + req.get('host') + req.originalUrl
    },
    meta: {
      totalPages: 1
    }
  })
}
