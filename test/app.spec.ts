import request from 'supertest'
import { app } from '../src/app'
import { assert } from 'chai'

describe("Test the accounts", () => {
  it("should respond with the accounts list", async () => {
    const response = await request(app).get("/za/pb/v1/accounts")
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body.data.accounts[3],{
        "accountId": "4675778129910189600000006",
        "accountNumber": "10012420006",
        "accountName": "Mr J Soap",
        "referenceName": "Mr J Soap",
        "productName": "Mortgage Loan Account"
    })
  })

  it("should respond with the account balance", async () => {
    const response = await request(app).get("/za/pb/v1/accounts/4675778129910189600000003/balance")
    assert.equal(response.statusCode,200)
    assert.deepEqual(response.body.data, {
        "accountId": "4675778129910189600000003",
        "currentBalance": -35696.04,
        "availableBalance": 0,
        "currency": "ZAR"
    })
  })

  it("should respond with 404 for invalid account on balance", async () => {
    const response = await request(app).get("/za/pb/v1/accounts/4675778129910189600000009/balance")
    assert.equal(response.statusCode,404)
  })

  it("should respond with transactions", async () => {
    const response = await request(app).get("/za/pb/v1/accounts/4675778129910189600000003/transactions?fromDate=2022-11-01")
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body.data.transactions[0], {
        "accountId": "4675778129910189600000003",
        "type": "DEBIT",
        "transactionType": "CardPurchases",
        "status": "POSTED",
        "description": "HTTP://WWW.UBEREATS.CO PARKTOWN NOR ZA",
        "cardNumber": "402167xxxxxx9999",
        "postedOrder": "1",
        "postingDate": "2023-01-22",
        "valueDate": "2022-05-15",
        "actionDate": "2022-04-24",
        "transactionDate": "2022-04-21",
        "amount": "40.99",
        "runningBalance": "-40.99"
    })
  })

  it("should respond with 404 for invalid account on transactions", async () => {
    const response = await request(app).get("/za/pb/v1/accounts/4675778129910189600000009/transactions")
    assert.equal(response.statusCode, 404)
  })
})

describe("Test the beneficiaries", () => {
    it("should respond with the beneficiaries", async () => {
      const response = await request(app).get("/za/pb/v1/accounts/beneficiaries")
      assert.equal(response.statusCode, 200)
    })
  
    it("should response the account balance", async () => {
      const response = await request(app).get("/za/pb/v1/accounts/4675778129910189600000003/balance")
      assert.equal(response.statusCode, 200)
    })
  })

  describe("Test the card helpers", () => {
    it("should respond with the merchant code list", async () => {
      const response = await request(app).get("/za/v1/cards/merchants")
      assert.equal(response.statusCode, 200)
      assert.deepEqual(response.body.data.result[3], {
        "code": "763",
        "name": "Agricultural Cooperative"
      })
    })
  
    it("should respond with the currency list", async () => {
        const response = await request(app).get("/za/v1/cards/currencies")
        assert.equal(response.statusCode, 200)
        assert.deepEqual(response.body.data.result[3], {
            "code": "EUR",
            "name": "Euro"
        })
    })

    it("should respond with the country list", async () => {
        const response = await request(app).get("/za/v1/cards/countries")
        assert.equal(response.statusCode, 200)
        assert.deepEqual(response.body.data.result[3], {
            "code": "AL",
            "name": "Albania"
        })
    })
  })