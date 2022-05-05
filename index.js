import 'dotenv/config'
import express from 'express'
import cards from './assets/data/cards.json'
import cors from 'cors'
import dayjs from 'dayjs'
import countries from './assets/data/countries.json'
import currencies from './assets/data/currencies.json'
import merchants from './assets/data/merchants.json'
import accounts from './assets/data/accounts.json'

const app = express()
const port = process.env.PORT || 3000
// const datafile = process.env.DATAFILE || 'data/accounts.json'

app.use(cors())
// Configuring body parser middleware
app.use(express.json())

const accessTokens = {}

app.post('/identity/v2/oauth2/token', (req, res) => {
  const authStr = Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString()
  const [clientId, clientSecret] = authStr.split(':')

  if (process.env.CLIENT_ID !== '' && process.env.CLIENT_SECRET !== '') {
    if (clientId !== process.env.CLIENT_ID || clientSecret !== process.env.CLIENT_SECRET) {
      return res.status(401).json()
    }
  }
  // Generate a token string
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  const expiryDate = dayjs().add(process.env.TOKEN_EXPIRY, 'seconds').format()
  accessTokens[token] = { expires_at: expiryDate, scope: 'accounts' }
  return res.json({ access_token: token, token_type: 'Bearer', expires_in: process.env.TOKEN_EXPIRY, scope: 'accounts' })
})

const isValidToken = (req) => {
  if (process.env.AUTH !== 'true') {
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

  const returnAccounts = []
  for (let i = 0; i < accounts.length; i++) {
    const account = {
      accountId: accounts[i].accountId,
      accountNumber: accounts[i].accountNumber,
      accountName: accounts[i].accountName,
      referenceName: accounts[i].referenceName,
      productName: accounts[i].productName
    }
    returnAccounts.push(account)
  }
  const data = { accounts: returnAccounts }
  return formatResponse(data, req, res)
})

app.get('/za/pb/v1/accounts/:accountId/balance', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }

  const accountId = req.params.accountId
  for (let i = 0; i < accounts.length; i++) {
    if (accounts[i].accountId === accountId) {
      const data = {
        accountId,
        currentBalance: accounts[i].currentBalance,
        availableBalance: accounts[i].availableBalance,
        currency: accounts[i].currency
      }
      return formatResponse(data, req, res)
    }
  }
  return res.status(404).json() // no account was found
})

app.get('/za/pb/v1/accounts/:accountId/transactions', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const accountId = req.params.accountId

  const toDate = req.query.toDate || dayjs().format('YYYY-MM-DD') // set to today
  const fromDate = req.query.fromDate || dayjs().subtract(180, 'day').format('YYYY-MM-DD') // set to 180 in the passed
  const transactionType = req.query.transactionType || null

  for (let i = 0; i < accounts.length; i++) {
    if (accounts[i].accountId === accountId) {
      const transactions = []
      for (let j = 0; j < accounts[i].transactions.length; j++) {
        if (transactionType !== null && accounts[i].transactions[j].transactionType !== transactionType) {
          continue
        }
        const transactionDate = dayjs(accounts[i].transactions[j].transactionDate)
        // compare both dates together
        if (transactionDate.isBefore(fromDate, 'day')) {
          continue
        }
        if (transactionDate.isAfter(toDate, 'day')) {
          continue
        }
        transactions.push(accounts[i].transactions[j])
      }
      const data = { transactions }
      return formatResponse(data, req, res)
    }
  }
  return res.status(404).json() // no account was found
})

app.get('/za/v1/cards', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const returnCards = []
  for (let i = 0; i < cards.length; i++) {
    const card = {
      CardKey: cards[i].CardKey,
      CardNumber: cards[i].CardNumber,
      IsProgrammable: cards[i].IsProgrammable,
      Status: cards[i].Status,
      CardTypeCode: cards[i].CardTypeCode,
      AccountNumber: cards[i].AccountNumber,
      AccountId: cards[i].AccountId
    }
    returnCards.push(card)
  }
  const data = { cards: returnCards }
  return formatResponse(data, req, res)
})

app.get('/za/v1/cards/:cardkey/code', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const cardkey = req.params.cardkey
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].CardKey === cardkey) {
      return formatResponse(cards[i].saved, req, res)
    }
  }
  return res.status(404).json() // no card was found
})

app.get('/za/v1/cards/:cardkey/publishedcode', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const cardkey = req.params.cardkey
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].CardKey === cardkey) {
      return formatResponse(cards[i].published, req, res)
    }
  }
  return res.status(404).json() // no card was found
})

app.post('/za/v1/cards/:cardkey/environmentvariables', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const cardkey = req.params.cardkey
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].CardKey === cardkey) {
      cards[i].variables = req.body
      cards[i].variables.createdAt = dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
      cards[i].variables.updatedAt = dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
      cards[i].variables.error = null
      return formatResponse(cards[i].variables, req, res)
    }
  }
  return res.status(404).json() // no card was found
})

app.get('/za/v1/cards/:cardkey/environmentvariables', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const cardkey = req.params.cardkey
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].CardKey === cardkey) {
      return formatResponse(cards[i].variables, req, res)
    }
  }
  return res.status(404).json() // no card was found
})

app.get('/za/v1/cards/countries', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  res.json(countries)
})

app.get('/za/v1/cards/currencies', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  res.json(currencies)
})

app.get('/za/v1/cards/merchants', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  res.json(merchants)
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
