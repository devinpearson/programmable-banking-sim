import request from 'supertest'
import { app } from './app-server'
import { assert } from 'chai'

const TEST_CARD_KEY = 'test-card-create-delete-001'
const TEST_CARD_TOGGLE_KEY = 'test-card-toggle-001'
const TEST_CARD_WRITE_KEY = 'test-card-write-001'

describe('Test the card helpers', () => {
  beforeAll(async () => {
    await request(app).delete(`/za/v1/cards/${TEST_CARD_KEY}`)
    await request(app).delete(`/za/v1/cards/${TEST_CARD_TOGGLE_KEY}`)
    await request(app).delete(`/za/v1/cards/${TEST_CARD_WRITE_KEY}`)
    await request(app).post('/za/v1/cards').send({ cardKey: TEST_CARD_WRITE_KEY })
  })

  afterAll(async () => {
    await request(app).delete(`/za/v1/cards/${TEST_CARD_WRITE_KEY}`)
  })
  it('should respond with the card list', async () => {
    const response = await request(app).get('/za/v1/cards')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body.data.cards[0], {
      CardKey: '700615',
      CardNumber: '402167XXXXXX1111',
      IsProgrammable: true,
      status: 'Active',
      CardTypeCode: 'vgs',
      AccountNumber: '10012420003',
      AccountId: '4675778129910189600000003',
    })
  })

  it('should respond with the cards saved code', async () => {
    const response = await request(app).get('/za/v1/cards/700615/code')
    assert.equal(response.statusCode, 200)
    
    const expectedStructure = {
      cardCode: {
        codeId: 'DC5A7EE9-DD2A-4327-9305-78B9185890CA',
        code: '// This function runs before a transaction.\n' +
          'const beforeTransaction = async (authorization) => {\n' +
          '  console.log(authorization);\n' +
          '};\n' +
          '// This function runs after a transaction was successful.\n' +
          'const afterTransaction = async (transaction) => {\n' +
          '  console.log(transaction);\n' +
          '};\n' +
          '// This function runs after a transaction was declined.\n' +
          'const afterDecline = async (transaction) => {\n' +
          '  console.log(transaction);\n' +
          '};',
      },
    }
    
    assert.equal(response.body.data.cardCode.codeId, expectedStructure.cardCode.codeId)
    assert.equal(response.body.data.cardCode.code, expectedStructure.cardCode.code)
    
    assert.exists(response.body.data.cardCode.createdAt)
    assert.exists(response.body.data.cardCode.updatedAt)
    assert.exists(response.body.data.cardCode.publishedAt)
    assert.isTrue(new Date(response.body.data.cardCode.createdAt) instanceof Date)
    assert.isTrue(new Date(response.body.data.cardCode.updatedAt) instanceof Date)
    assert.isTrue(new Date(response.body.data.cardCode.publishedAt) instanceof Date)
  })

  it('should respond with the cards published code', async () => {
    const response = await request(app).get('/za/v1/cards/700615/publishedcode')
    assert.equal(response.statusCode, 200)
    
    const expectedStructure = {
      cardCode: {
        codeId: '3BB77753-R2D2-4U2B-1A2B-4C213E7D0AC3',
        code: '// This function runs before a transaction.\n' +
          'const beforeTransaction = async (authorization) => {\n' +
          '  console.log(authorization);\n' +
          '};\n' +
          '// This function runs after a transaction was successful.\n' +
          'const afterTransaction = async (transaction) => {\n' +
          '  console.log(transaction);\n' +
          '};\n' +
          '// This function runs after a transaction was declined.\n' +
          'const afterDecline = async (transaction) => {\n' +
          '  console.log(transaction);\n' +
          '};',
      },
    }
    
    assert.equal(response.body.data.cardCode.codeId, expectedStructure.cardCode.codeId)
    assert.equal(response.body.data.cardCode.code, expectedStructure.cardCode.code)
    assert.exists(response.body.data.cardCode.createdAt)
    assert.exists(response.body.data.cardCode.updatedAt)
    assert.exists(response.body.data.cardCode.publishedAt)
    assert.isTrue(new Date(response.body.data.cardCode.createdAt) instanceof Date)
    assert.isTrue(new Date(response.body.data.cardCode.updatedAt) instanceof Date)
    assert.isTrue(new Date(response.body.data.cardCode.publishedAt) instanceof Date)
  })

  it('should respond with the merchant code list', async () => {
    const response = await request(app).get('/za/v1/cards/merchants')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body.data.result[3], {
      code: '763',
      name: 'Agricultural Cooperative',
    })
  })

  it('should respond with the currency list', async () => {
    const response = await request(app).get('/za/v1/cards/currencies')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body.data.result[3], {
      code: 'EUR',
      name: 'Euro',
    })
  })

  it('should respond with the country list', async () => {
    const response = await request(app).get('/za/v1/cards/countries')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body.data.result[3], {
      code: 'AL',
      name: 'Albania',
    })
  })

  it('should create and delete a card', async () => {
    const cardKey = TEST_CARD_KEY
    const createResponse = await request(app)
      .post('/za/v1/cards')
      .send({ cardKey })
    assert.equal(createResponse.statusCode, 200)
    assert.equal(createResponse.body.data.cardKey, cardKey)

    const duplicateResponse = await request(app)
      .post('/za/v1/cards')
      .send({ cardKey })
    assert.equal(duplicateResponse.statusCode, 409)

    const deleteResponse = await request(app).delete(`/za/v1/cards/${cardKey}`)
    assert.equal(deleteResponse.statusCode, 200)

    const secondDeleteResponse = await request(app).delete(
      `/za/v1/cards/${cardKey}`,
    )
    assert.equal(secondDeleteResponse.statusCode, 404)
  })

  it('should toggle the programmable feature on a card', async () => {
    const cardKey = TEST_CARD_TOGGLE_KEY
    await request(app).post('/za/v1/cards').send({ cardKey })

    const enableResponse = await request(app)
      .post(`/za/v1/cards/${cardKey}/toggle-programmable-feature`)
      .send({ Enabled: true })
    assert.equal(enableResponse.statusCode, 200)
    assert.equal(enableResponse.body.Enabled, true)

    const disableResponse = await request(app)
      .post(`/za/v1/cards/${cardKey}/toggle-programmable-feature`)
      .send({ Enabled: false })
    assert.equal(disableResponse.statusCode, 200)
    assert.equal(disableResponse.body.Enabled, false)

    await request(app).delete(`/za/v1/cards/${cardKey}`)
  })

  it('should respond with 404 toggling the programmable feature on an invalid card', async () => {
    const response = await request(app)
      .post('/za/v1/cards/does-not-exist/toggle-programmable-feature')
      .send({ Enabled: true })
    assert.equal(response.statusCode, 404)
  })

  it('should execute the published code live and record the execution', async () => {
    const response = await request(app)
      .post('/za/v1/cards/700615/code/execute-live')
      .send({
        currencyCode: 'ZAR',
        centsAmount: 1000,
        merchantCode: '5411',
        merchantName: 'Test Merchant',
        merchantCity: 'Cape Town',
        countryCode: 'ZA',
      })
    assert.equal(response.statusCode, 200)
    assert.isBoolean(response.body.data.result)
    // The seeded card is linked to a real account, so an approved swipe leaves
    // a pending hold there. Reverse it so other suites see the seeded balance.
    const hold = response.body.data.transaction
    if (hold) {
      await request(app).delete(
        `/za/pb/v1/accounts/${hold.accountId}/pending-transactions/${hold.transactionId}`,
      )
    }
  })

  it('should respond with the executions for a card', async () => {
    const response = await request(app).get(
      '/za/v1/cards/700615/code/executions',
    )
    assert.equal(response.statusCode, 200)
    assert.isArray(response.body.data.executions)
  })

  it('should respond with 404 for executions on an invalid card', async () => {
    const response = await request(app).get(
      '/za/v1/cards/does-not-exist/code/executions',
    )
    assert.equal(response.statusCode, 404)
  })

  it('should update and retrieve the saved code', async () => {
    const newCode = 'const beforeTransaction = async (auth) => { return true; };'
    const updateResponse = await request(app)
      .post(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/code`)
      .send({ code: newCode })
    assert.equal(updateResponse.statusCode, 200)
    assert.equal(updateResponse.body.data.cardCode.code, newCode)

    const getResponse = await request(app).get(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/code`)
    assert.equal(getResponse.statusCode, 200)
    assert.equal(getResponse.body.data.cardCode.code, newCode)
  })

  it('should respond with 404 when updating saved code on an invalid card', async () => {
    const response = await request(app)
      .post('/za/v1/cards/does-not-exist/code')
      .send({ code: 'const x = 1;' })
    assert.equal(response.statusCode, 404)
  })

  it('should update and retrieve the published code', async () => {
    const newCode = 'const afterTransaction = async (tx) => { return true; };'
    const updateResponse = await request(app)
      .post(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/publishedcode`)
      .send({ code: newCode })
    assert.equal(updateResponse.statusCode, 200)
    assert.equal(updateResponse.body.data.cardCode.code, newCode)

    const getResponse = await request(app).get(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/publishedcode`)
    assert.equal(getResponse.statusCode, 200)
    assert.equal(getResponse.body.data.cardCode.code, newCode)
  })

  it('should respond with 404 when updating published code on an invalid card', async () => {
    const response = await request(app)
      .post('/za/v1/cards/does-not-exist/publishedcode')
      .send({ code: 'const x = 1;' })
    assert.equal(response.statusCode, 404)
  })

  it('should update and retrieve environment variables', async () => {
    const variables = { MY_VAR: 'hello', ANOTHER_VAR: '42' }
    const updateResponse = await request(app)
      .post(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/environmentvariables`)
      .send({ variables })
    assert.equal(updateResponse.statusCode, 200)
    assert.deepEqual(updateResponse.body.data.result.variables, variables)

    const getResponse = await request(app).get(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/environmentvariables`)
    assert.equal(getResponse.statusCode, 200)
    assert.deepEqual(getResponse.body.data.result.variables, variables)
  })

  it('should respond with 404 when updating env vars on an invalid card', async () => {
    const response = await request(app)
      .post('/za/v1/cards/does-not-exist/environmentvariables')
      .send({ variables: {} })
    assert.equal(response.statusCode, 404)
  })

  it('should execute simulation code and record the result', async () => {
    const response = await request(app)
      .post(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/code/execute`)
      .send({
        simulationcode: 'const beforeTransaction = async (auth) => { console.log(auth); };',
        currencyCode: 'ZAR',
        centsAmount: 500,
        merchantCode: '5411',
        merchantName: 'Sim Merchant',
        merchantCity: 'Johannesburg',
        countryCode: 'ZA',
      })
    assert.equal(response.statusCode, 200)
    assert.isArray(response.body.data.result)
  })

  it('should respond with 404 when executing code on an invalid card', async () => {
    const response = await request(app)
      .post('/za/v1/cards/does-not-exist/code/execute')
      .send({
        simulationcode: '',
        currencyCode: 'ZAR',
        centsAmount: 100,
        merchantCode: '5411',
        merchantName: 'Test',
        merchantCity: 'Cape Town',
        countryCode: 'ZA',
      })
    assert.equal(response.statusCode, 404)
  })

  it('should respond with 404 when executing live code on an invalid card', async () => {
    const response = await request(app)
      .post('/za/v1/cards/does-not-exist/code/execute-live')
      .send({
        currencyCode: 'ZAR',
        centsAmount: 1000,
        merchantCode: '5411',
        merchantName: 'Test',
        merchantCity: 'Cape Town',
        countryCode: 'ZA',
      })
    assert.equal(response.statusCode, 404)
  })

  it('should return true from execute-live when the published code has an afterTransaction handler', async () => {
    const afterTxCode =
      'const afterTransaction = async (transaction) => { console.log(transaction); };'
    await request(app)
      .post(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/publishedcode`)
      .send({ code: afterTxCode })

    const response = await request(app)
      .post(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/code/execute-live`)
      .send({
        currencyCode: 'ZAR',
        centsAmount: 1000,
        merchantCode: '5411',
        merchantName: 'Test Merchant',
        merchantCity: 'Cape Town',
        countryCode: 'ZA',
      })
    assert.equal(response.statusCode, 200)
    assert.isBoolean(response.body.data.result)
    assert.isTrue(response.body.data.result)
  })

  it('should execute live code and record the execution in the DB', async () => {
    const response = await request(app)
      .post(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/code/execute-live`)
      .send({
        currencyCode: 'ZAR',
        centsAmount: 500,
        merchantCode: '5411',
        merchantName: 'Live Exec',
        merchantCity: 'Durban',
        countryCode: 'ZA',
      })
    assert.equal(response.statusCode, 200)
    assert.isBoolean(response.body.data.result)

    const executionsResponse = await request(app).get(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/code/executions`)
    assert.equal(executionsResponse.statusCode, 200)
    assert.isArray(executionsResponse.body.data.executions)
    assert.isAbove(executionsResponse.body.data.executions.length, 0)
  })

  it('should execute simulation code without a simulationcode field and default to empty string', async () => {
    const response = await request(app)
      .post(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/code/execute`)
      .send({
        currencyCode: 'ZAR',
        centsAmount: 100,
        merchantCode: '5411',
        merchantName: 'No Code',
        merchantCity: 'Pretoria',
        countryCode: 'ZA',
      })
    assert.equal(response.statusCode, 200)
    assert.isArray(response.body.data.result)
  })

  it('should update saved code with no code field and default to empty string', async () => {
    const response = await request(app)
      .post(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/code`)
      .send({})
    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.cardCode.code, '')
  })

  it('should update published code with no code field and default to empty string', async () => {
    const response = await request(app)
      .post(`/za/v1/cards/${TEST_CARD_WRITE_KEY}/publishedcode`)
      .send({})
    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.cardCode.code, '')
  })

  it('should cascade-delete a card\'s executions and logs', async () => {
    const cardKey = 'test-cascade-exec-001'
    await request(app).delete(`/za/v1/cards/${cardKey}`)
    await request(app).post('/za/v1/cards').send({ cardKey })

    // Produce an execution (and its logs).
    await request(app)
      .post(`/za/v1/cards/${cardKey}/code/execute`)
      .send({
        simulationcode: 'const beforeTransaction = async (auth) => { console.log(auth); };',
        currencyCode: 'ZAR',
        centsAmount: 500,
        merchantCode: '5411',
        merchantName: 'Sim Merchant',
        merchantCity: 'Johannesburg',
        countryCode: 'ZA',
      })
    const before = await request(app).get(`/za/v1/cards/${cardKey}/code/executions`)
    assert.isAbove(before.body.data.executions.length, 0)

    // Delete the card, then recreate it with the same key: executions must not survive.
    const deleteResponse = await request(app).delete(`/za/v1/cards/${cardKey}`)
    assert.equal(deleteResponse.statusCode, 200)
    await request(app).post('/za/v1/cards').send({ cardKey })

    const after = await request(app).get(`/za/v1/cards/${cardKey}/code/executions`)
    assert.equal(after.statusCode, 200)
    assert.equal(after.body.data.executions.length, 0)

    await request(app).delete(`/za/v1/cards/${cardKey}`)
  })
})
