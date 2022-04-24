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
        accounts: accounts
      },
      links: {
        self: `${url}/za/pb/v1/accounts`
      },
      meta: {
        totalPages: 1
      }
    }
    res.send(result)
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
            accountId: accountId,
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
        res.send(result)
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
            transactions: transactions
          },
          links: {
            self: `${url}/za/pb/v1/accounts/${accountId}/transactions`
          },
          meta: {
            totalPages: 1
          }
        }
        res.send(result)
        break
      }
    }
  })
})

app.get('/za/v1/cards/countries', (req, res) => {
  fs.readFile('data/countries.json', 'utf8', function (err, data) {
    if (err) throw err
    res.send(data)
  })
})

app.get('/za/v1/cards/currencies', (req, res) => {
  fs.readFile('data/currencies.json', 'utf8', function (err, data) {
    if (err) throw err
    res.send(data)
  })
})

app.get('/za/v1/cards/merchants', (req, res) => {
  fs.readFile('data/merchants.json', 'utf8', function (err, data) {
    if (err) throw err
    res.send(data)
  })
})

app.listen(port, () => console.log(`Programmable banking sim listening on port ${port}!`))
