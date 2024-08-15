import request from 'supertest'
import { app } from '../src/app'
import { assert } from 'chai'

describe('Test the beneficiaries', () => {
  it('should respond with the beneficiaries', async () => {
    const response = await request(app).get('/za/pb/v1/accounts/beneficiaries')
    assert.equal(response.statusCode, 200)
  })
})
