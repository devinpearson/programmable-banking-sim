import request from 'supertest'
import { app } from '../src/app'
import { assert } from 'chai'

describe("Test the environmental variables", () => {
    it("should respond with the environmental variables", async () => {
        const response = await request(app).get("/za/v1/cards/700615/environmentvariables")
        assert.equal(response.statusCode,200)
        assert.deepEqual(response.body.data, {
            "result": {
                "variables": {
                    "test1": "value11",
                    "test2": "value22"
                },
                "createdAt": "2023-06-27T07:18:12.086Z",
                "updatedAt": "2023-06-27T07:18:12.086Z",
                "error": null
            }
        })
    })
})