import request from 'supertest'
import { app } from '../src/app'
import { assert } from 'chai'

describe('Test the environmental variables', () => {
  it('should respond with the environmental variables', async () => {
    const response = await request(app).get(
      '/za/v1/cards/700615/environmentvariables',
    )
    assert.equal(response.statusCode, 200)
    assert.exists(response.body.data.result)
    assert.property(response.body.data.result, 'variables')
    assert.property(response.body.data.result, 'createdAt')
    assert.property(response.body.data.result, 'updatedAt')
    assert.property(response.body.data.result, 'error')
    assert.isObject(response.body.data.result.variables)
    assert.isTrue(new Date(response.body.data.result.createdAt) instanceof Date)
    assert.isTrue(new Date(response.body.data.result.updatedAt) instanceof Date)
    assert.equal(response.body.data.result.error, null)
  })
})
