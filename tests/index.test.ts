import request from 'supertest'
import { app } from '../src/app'

describe("Test the accounts", () => {
  test("It should respond with the accounts list", async () => {
    const response = await request(app).get("/za/pb/v1/accounts");
    expect(response.statusCode).toBe(200);
    expect(response.body.data.accounts[3]).toMatchObject({
        "accountId": "4675778129910189600000006",
        "accountNumber": "10012420006",
        "accountName": "Mr J Soap",
        "referenceName": "Mr J Soap",
        "productName": "Mortgage Loan Account"
    })
  });

  test("It should respond with the account balance", async () => {
    const response = await request(app).get("/za/pb/v1/accounts/4675778129910189600000003/balance");
    expect(response.statusCode).toBe(200);
    expect(response.body.data).toMatchObject({
        "accountId": "4675778129910189600000003",
        "currentBalance": -35696.04,
        "availableBalance": 0,
        "currency": "ZAR"
    })
  });

  test("It should respond with 404 for invalid account on balance", async () => {
    const response = await request(app).get("/za/pb/v1/accounts/4675778129910189600000009/balance");
    expect(response.statusCode).toBe(404);
  });

  test("It should respond with transactions", async () => {
    const response = await request(app).get("/za/pb/v1/accounts/4675778129910189600000003/transactions?fromDate=2022-11-01");
    expect(response.statusCode).toBe(200);
    expect(response.body.data.transactions[0]).toMatchObject({
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
    });
  });

  test("It should respond with 404 for invalid account on transactions", async () => {
    const response = await request(app).get("/za/pb/v1/accounts/4675778129910189600000009/transactions");
    expect(response.statusCode).toBe(404);
  });
});

describe("Test the beneficiaries", () => {
    test("It should respond with the beneficiaries", async () => {
      const response = await request(app).get("/za/pb/v1/accounts/beneficiaries");
      expect(response.statusCode).toBe(200);
    });
  
    // test("It should response the account balance", async () => {
    //   const response = await request(app).get("/za/pb/v1/accounts/4675778129910189600000003/balance");
    //   expect(response.statusCode).toBe(200);
    // });
  });

  describe("Test the card helpers", () => {
    test("It should respond with the merchant code list", async () => {
      const response = await request(app).get("/za/v1/cards/merchants");
      expect(response.statusCode).toBe(200);
      expect(response.body.data.result[3]).toMatchObject({
        "code": "763",
        "name": "Agricultural Cooperative"
      })
    });
  
    test("It should respond with the currency list", async () => {
        const response = await request(app).get("/za/v1/cards/currencies");
        expect(response.statusCode).toBe(200);
        expect(response.body.data.result[3]).toMatchObject({
            "code": "EUR",
            "name": "Euro"
        })
      });

    test("It should respond with the country list", async () => {
        const response = await request(app).get("/za/v1/cards/countries");
        expect(response.statusCode).toBe(200);
        // @todo countries are missing
    });
  });