import request from 'supertest'
import { app } from '../src/app'
import { assert } from 'chai'

describe("Test the card helpers", () => {

    it("should respond with the card list", async () => {
        const response = await request(app).get("/za/v1/cards")
        assert.equal(response.statusCode,200)
        assert.deepEqual(response.body.data.cards[0], {
            "CardKey": "700615",
            "CardNumber": "402167XXXXXX1111",
            "IsProgrammable": true,
            "status": "Active",
            "CardTypeCode": "vgs",
            "AccountNumber": "10012420003",
            "AccountId": "4675778129910189600000003"
        })
    })

    it("should respond with the cards saved code", async () => {
        const response = await request(app).get("/za/v1/cards/700615/code")
        assert.equal(response.statusCode,200)
        assert.deepEqual(response.body.data, {
            "cardCode": {
                "codeId": "DC5A7EE9-DD2A-4327-9305-78B9185890CA",
                "code": "// This function runs before a transaction.\nconst beforeTransaction = async (authorization) => {\n  console.log(authorization);\n};\n// This function runs after a transaction was successful.\nconst afterTransaction = async (transaction) => {\n  console.log(transaction);\n};\n// This function runs after a transaction was declined.\nconst afterDecline = async (transaction) => {\n  console.log(transaction);\n};",
                "createdAt": "2024-08-01T13:05:33.685Z",
                "updatedAt": "2024-08-01T13:05:33.685Z",
                "publishedAt": "2024-08-01T13:05:33.685Z"
            }
        })
    })

    it("should respond with the cards published code", async () => {
        const response = await request(app).get("/za/v1/cards/700615/publishedcode")
        assert.equal(response.statusCode,200)
        assert.deepEqual(response.body.data, {
            "cardCode": {
                "codeId": "3BB77753-R2D2-4U2B-1A2B-4C213E7D0AC3",
                "code": "// This function runs before a transaction.\nconst beforeTransaction = async (authorization) => {\n  console.log(authorization);\n};\n// This function runs after a transaction was successful.\nconst afterTransaction = async (transaction) => {\n  console.log(transaction);\n};\n// This function runs after a transaction was declined.\nconst afterDecline = async (transaction) => {\n  console.log(transaction);\n};",
                "createdAt": "2024-08-01T13:05:33.685Z",
                "updatedAt": "2024-08-01T13:05:33.685Z",
                "publishedAt": "2024-08-01T13:05:33.685Z"
            }
        })
    })

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