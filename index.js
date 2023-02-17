require('dotenv').config()
const port = process.env.PORT || 3000
const envClientId = process.env.CLIENT_ID
const envClientSecret = process.env.CLIENT_SECRET
const envTokenExpiry = process.env.TOKEN_EXPIRY
const envAuth = process.env.AUTH
const dbFile = process.env.DB_FILE || 'investec.db'
// const overdraft = process.env.OVERDRAFT || 5000

const express = require('express')
const cors = require('cors')
const dayjs = require('dayjs')
const db = require('better-sqlite3')(dbFile)
const database = require('./database')
const generator = require('./generate')
db.pragma('journal_mode = WAL')

// database.prepareDB(db)
// database.prepareAccounts(db)
// database.prepareTransactions(db)
// database.prepareCountries(db)
// database.prepareCurrencies(db)
// database.prepareMerchants(db)

const app = express()
app.use(cors())
// Configuring body parser middleware
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

const accessTokens = {}

app.post('/identity/v2/oauth2/token', (req, res) => {
  const authStr = Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString()
  const [clientId, clientSecret] = authStr.split(':')

  if (envClientId !== '' && envClientSecret !== '') {
    if (clientId !== envClientId || clientSecret !== envClientSecret) {
      return res.status(401).json()
    }
  }
  // Generate a token string
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  const expiryDate = dayjs().add(envTokenExpiry, 'seconds').format()
  accessTokens[token] = { expires_at: expiryDate, scope: 'accounts' }
  return res.json({ access_token: token, token_type: 'Bearer', expires_in: envTokenExpiry, scope: 'accounts' })
})

function isValidToken (req) {
  if (envAuth !== 'true') {
    return true
  }
  const authorization = req.get('authorization').split(' ')[1]
  if (accessTokens[authorization] && dayjs().isBefore(accessTokens[authorization].expires_at)) {
    return true
  }

  return false
}

app.get('/za/pb/v1/accounts', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const accounts = db.prepare('SELECT * FROM accounts').all()
  const data = { accounts }
  return formatResponse(data, req, res)
})

app.get('/za/pb/v1/accounts/:accountId/balance', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const accountId = req.params.accountId

  if (!database.isValidAccount(db, accountId)) {
    return res.status(404).json() // no account was found
  }
  const balance = database.accountBalance(db, accountId)

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

app.get('/za/pb/v1/accounts/:accountId/transactions', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const accountId = req.params.accountId
  // check that the account exists
  if (!database.isValidAccount(db, accountId)) {
    return res.status(404).json() // no account was found
  }

  const transactionsArr = database.transactions(db, accountId)
  // console.log(transactionsArr)
  const toDate = req.query.toDate ?? dayjs().format('YYYY-MM-DD') // set to today
  const fromDate = req.query.fromDate ?? dayjs().subtract(180, 'day').format('YYYY-MM-DD') // set to 180 in the passed
  const transactionType = req.query.transactionType ?? null

  let postedOrder = 0
  let runningBalance = 0
  const transactions = []
  for (let j = 0; j < transactionsArr.length; j++) {
    postedOrder++
    if (transactionsArr[j].type === 'CREDIT') {
      runningBalance += transactionsArr[j].amount
    } else {
      runningBalance -= transactionsArr[j].amount
    }
    if (transactionType !== null && transactionsArr[j].transactionType !== transactionType) {
      continue
    }
    const transactionDate = dayjs(transactionsArr[j].postingDate)
    // compare both dates together
    if (transactionDate.isBefore(fromDate, 'day')) {
      continue
    }
    if (transactionDate.isAfter(toDate, 'day')) {
      continue
    }
    transactionsArr[j].postedOrder = postedOrder
    transactionsArr[j].runningBalance = +runningBalance.toFixed(2)
    transactions.push(transactionsArr[j])
  }
  const data = { transactions }
  return formatResponse(data, req, res)
})

// function to create transactions for an account
app.post('/za/pb/v1/accounts/:accountId/transactions', (req, res) => {
  let transaction = generator.randomTransaction(req.params.accountId)
  transaction = { ...transaction, ...req.body }
  // check that the account exists
  if (!database.isValidAccount(db, transaction.accountId)) {
    return res.status(404).json() // no account was found
  }
  // insert the transaction
  database.insertTransaction(db, transaction)
  return formatResponse(transaction, req, res)
})

app.delete('/za/pb/v1/accounts/:accountId/transactions/:postingDate', (req, res) => {
  const accountId = req.params.accountId
  const postingDate = req.params.postingDate
  // check that the account exists
  if (!database.isValidAccount(db, accountId)) {
    return res.status(404).json() // no account was found
  }
  // insert the transaction
  database.deleteTransaction(db, accountId, postingDate)
  return res.status(200).json()
})

// function to create an account
app.post('/za/pb/v1/accounts', (req, res) => {
  let account = generator.randomAccount()
  account = { ...account, ...req.body }
  // check that the account exists
  if (database.isValidAccount(db, account.accountId)) {
    return res.status(404).json() // account already exists
  }
  // insert the transaction
  database.insertAccount(db, account)
  return formatResponse(account, req, res)
})

// function to delete an account
app.delete('/za/pb/v1/accounts/:accountId', (req, res) => {
  const accountId = req.params.accountId
  // check that the account exists
  if (!database.isValidAccount(db, accountId)) {
    return res.status(404).json() // account already exists
  }
  // remove the transactions
  database.removeTransactions(db, accountId)
  database.removeAccount(db, accountId)
  return res.status(200).json()
})

app.get('/za/v1/cards/countries', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const result = database.countries(db)
  const data = { result }
  return formatResponse(data, req, res)
})

app.get('/za/v1/cards/currencies', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const result = database.currencies(db)
  const data = { result }
  return formatResponse(data, req, res)
})

app.get('/za/v1/cards/merchants', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const result = database.merchants(db)
  const data = { result }
  return formatResponse(data, req, res)
})

const formatResponse = (data, req, res) => {
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

app.listen(port, () => console.log(`Programmable banking sim listening on port ${port}!`))
