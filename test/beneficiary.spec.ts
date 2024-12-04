import request from 'supertest'
import { app } from '../src/app.js'
import { assert, describe, it } from 'vitest'

describe('Test the beneficiaries', () => {
  it('should respond with the beneficiaries', async () => {
    const response = await request(app).get('/za/pb/v1/accounts/beneficiaries')
    assert.equal(response.statusCode, 200)
  })
})
