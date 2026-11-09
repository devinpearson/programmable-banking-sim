import request from 'supertest'
import { app } from '../src/app'
import { assert } from 'chai'

const TEST_BENEFICIARY_ID = 'test-beneficiary-create-delete-001'

describe('Test the beneficiaries', () => {
  beforeAll(async () => {
    await request(app).delete(`/za/pb/v1/accounts/beneficiaries/${TEST_BENEFICIARY_ID}`)
  })

  it('should respond with the beneficiaries', async () => {
    const response = await request(app).get('/za/pb/v1/accounts/beneficiaries')
    assert.equal(response.statusCode, 200)
  })

  it('should create and delete a beneficiary', async () => {
    const beneficiaryId = TEST_BENEFICIARY_ID
    const createResponse = await request(app)
      .post('/za/pb/v1/accounts/beneficiaries')
      .send({ beneficiaryId, beneficiaryName: 'Test Beneficiary' })
    assert.equal(createResponse.statusCode, 200)
    assert.equal(createResponse.body.data.beneficiaryId, beneficiaryId)
    assert.equal(createResponse.body.data.beneficiaryName, 'Test Beneficiary')

    const deleteResponse = await request(app).delete(
      `/za/pb/v1/accounts/beneficiaries/${beneficiaryId}`,
    )
    assert.equal(deleteResponse.statusCode, 200)
  })

  it('should respond with 404 when deleting a non-existent beneficiary', async () => {
    const response = await request(app).delete(
      '/za/pb/v1/accounts/beneficiaries/does-not-exist',
    )
    assert.equal(response.statusCode, 404)
  })
})
