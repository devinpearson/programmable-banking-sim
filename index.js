const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs')

const app = express()
const port = 3000

app.use(cors())

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const accessTokens = new Set()

app.post('/identity/v2/oauth2/token', (req, res) => {
  const authStr = Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString()
  console.log(Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString())
  const [clientId, clientSecret] = authStr.split(':')
  // if (clientId !== 'client_id' || clientSecret !== 'client_secret') {
  // res.status(400).json({ message: 'Invalid auth token' });
  // }
  // Generate a string
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

  accessTokens.add('Bearer ' + token)
  res.json({ access_token: token, token_type: 'Bearer', expires_in: 1799, scope: 'accounts' })
})

app.get('/za/pb/v1/accounts', (req, res) => {
  const url = req.protocol + '://' + req.get('host')
  fs.readFile('data/accounts.json', 'utf8', function (err, data) {
    if (err) throw err
    const dataObj = JSON.parse(data)
    const accounts = []
    for (let i = 0; i < dataObj.length; i++) {
      const account = {
        accountId: dataObj[i].accountId,
        accountNumber: dataObj[i].accountNumber,
        accountName: dataObj[i].accountName,
        referenceName: dataObj[i].referenceName,
        productName: dataObj[i].productName
      }
      accounts.push(account)
    }
    const result = {
      data: {
        accounts
      },
      links: {
        self: `${url}/za/pb/v1/accounts`
      },
      meta: {
        totalPages: 1
      }
    }
    res.json(result)
  })
})

app.get('/za/pb/v1/accounts/:accountId/balance', (req, res) => {
  const url = req.protocol + '://' + req.get('host')
  const accountId = req.params.accountId
  fs.readFile('data/accounts.json', 'utf8', function (err, data) {
    if (err) throw err
    const dataObj = JSON.parse(data)
    for (let i = 0; i < dataObj.length; i++) {
      if (dataObj[i].accountId === accountId) {
        const result = {
          data: {
            accountId,
            currentBalance: dataObj[i].currentBalance,
            availableBalance: dataObj[i].availableBalance,
            currency: dataObj[i].currency
          },
          links: {
            self: `${url}/za/pb/v1/accounts/${accountId}/balance`
          },
          meta: {
            totalPages: 1
          }
        }
        res.json(result)
        break
      }
    }
  })
})

app.get('/za/pb/v1/accounts/:accountId/transactions', (req, res) => {
  const url = req.protocol + '://' + req.get('host')
  const accountId = req.params.accountId

  const fromDate = req.query.fromDate ?? null // set to 180 in the passed
  const toDate = req.query.toDate ?? null // set to today
  const transactionType = req.query.transactionType ?? null

  fs.readFile('data/accounts.json', 'utf8', function (err, data) {
    if (err) throw err
    const dataObj = JSON.parse(data)
    for (let i = 0; i < dataObj.length; i++) {
      if (dataObj[i].accountId === accountId) {
        const transactions = []
        for (let j = 0; j < dataObj[i].transactions.length; j++) {
          if (transactionType !== null && dataObj[i].transactions[j].transactionType !== transactionType) {
            continue
          }
          // compare both dates together
          if (fromDate !== null && new Date(dataObj[i].transactions[j].transactionDate) < new Date(fromDate)) {
            continue
          }
          if (toDate !== null && new Date(dataObj[i].transactions[j].transactionDate) > new Date(toDate)) {
            continue
          }
          transactions.push(dataObj[i].transactions[j])
        }
        const result = {
          data: {
            transactions
          },
          links: {
            self: `${url}/za/pb/v1/accounts/${accountId}/transactions`
          },
          meta: {
            totalPages: 1
          }
        }
        res.json(result)
        break
      }
    }
  })
})

app.get('/za/v1/cards/countries', (req, res) => {
  const authorization = req.get('authorization')
  if (!accessTokens.has(authorization)) {
    return res.status(403).json({ message: 'Unauthorized' })
  }
  fs.readFile('data/countries.json', 'utf8', function (err, data) {
    if (err) throw err
    res.json(JSON.parse(data))
  })
})

app.get('/za/v1/cards/currencies', (req, res) => {
  const authorization = req.get('authorization')
  if (!accessTokens.has(authorization)) {
    return res.status(403).json({ message: 'Unauthorized' })
  }
  fs.readFile('data/currencies.json', 'utf8', function (err, data) {
    if (err) throw err
    res.json(JSON.parse(data))
  })
})

app.get('/za/v1/cards/merchants', (req, res) => {
  const authorization = req.get('authorization')
  if (!accessTokens.has(authorization)) {
    return res.status(403).json({ message: 'Unauthorized' })
  }
  fs.readFile('data/merchants.json', 'utf8', function (err, data) {
    if (err) throw err
    res.json(JSON.parse(data))
  })
})

app.listen(port, () => console.log(`Programmable banking sim listening on port ${port}!`))
