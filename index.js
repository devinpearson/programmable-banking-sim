const express = require('express')
let fs = require('fs')
const app = express()
const port = 3000

app.get('/za/pb/v1/accounts', (req, res) => {
  let url = req.protocol + '://' + req.get('host')
  fs.readFile('data/accounts.json', 'utf8', function(err, data) {
    if (err) throw err;
    let dataObj = JSON.parse(data)
    let accounts = []
    for (let i = 0; i < dataObj.length; i++) {
      let account = {
        accountId: dataObj[i].accountId,
        accountNumber: dataObj[i].accountNumber,
        accountName: dataObj[i].accountName,
        referenceName: dataObj[i].referenceName,
        productName: dataObj[i].productName,
      }
      accounts.push(account)
    }
    let result = {
      "data": { 
        "accounts": accounts,
      },
      "links": {
        "self": `${url}/za/pb/v1/accounts`
      },
      "meta": {
          "totalPages": 1
      }
    }
    res.send(result) 
  })
});

app.get('/za/pb/v1/accounts/:accountId/balance', (req, res) => {
  let url = req.protocol + '://' + req.get('host')
  const accountId = req.params.accountId;
  fs.readFile('data/accounts.json', 'utf8', function(err, data) {
    if (err) throw err;
    let dataObj = JSON.parse(data)
    for (let i = 0; i < dataObj.length; i++) {
      if (dataObj[i].accountId == accountId) {
        let result = {
          "data": {
            "accountId": accountId,
            "currentBalance": dataObj[i].currentBalance,
            "availableBalance": dataObj[i].availableBalance,
            "currency": dataObj[i].currency,
          },
          "links": {
            "self": `${url}/za/pb/v1/accounts/${accountId}/balance`
          },
          "meta": {
              "totalPages": 1
          }
        }
        res.send(result) 
        break
      }
    }
  })
});

app.get('/za/pb/v1/accounts/:accountId/transactions', (req, res) => {
  let url = req.protocol + '://' + req.get('host')
  const accountId = req.params.accountId;
  fs.readFile('data/accounts.json', 'utf8', function(err, data) {
    if (err) throw err;
    let dataObj = JSON.parse(data)
    for (let i = 0; i < dataObj.length; i++) {
      if (dataObj[i].accountId == accountId) {
        let result = {
          "data": {
            "transactions": dataObj[i].transactions,
          },
          "links": {
            "self": `${url}/za/pb/v1/accounts/${accountId}/transactions`
          },
          "meta": {
              "totalPages": 1
          }
        }
        res.send(result) 
        break
      }
    }
  })
});

app.get('/za/v1/cards/countries', (req, res) => {
  fs.readFile('data/countries.json', 'utf8', function(err, data) {
    if (err) throw err;
    res.send(data) 
  })
});
	
app.get('/za/v1/cards/currencies', (req, res) => {
  fs.readFile('data/currencies.json', 'utf8', function(err, data) {
    if (err) throw err;
    res.send(data) 
  })
})

app.get('/za/v1/cards/merchants', (req, res) => {
  fs.readFile('data/merchants.json', 'utf8', function(err, data) {
    if (err) throw err;
    res.send(data) 
  })
})

app.listen(port, () => console.log(`Programmable banking sim listening on port ${port}!`))
