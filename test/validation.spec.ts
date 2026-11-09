import request from 'supertest'
import { assert } from 'chai'
import { app } from './app-server'

// zod request validation (src/schema/requestSchemas.ts): bad input gets a 400
// naming the field instead of a 500 or a silent default.
const MAIN = '4675778129910189600000003'
const SAVER = '4675778129910189600000004'
const ACCOUNTS = '/za/pb/v1/accounts'

describe('Request validation', () => {
  it('rejects an unknown field when creating an account, naming it', async () => {
    const response = await request(app).post(ACCOUNTS).send({ accountId: 'v-acct', accountNumbr: '1' })
    assert.equal(response.statusCode, 400)
    assert.match(response.body.errorMessage, /Unrecognized key\(s\) in object: 'accountNumbr'/)
    assert.equal(response.body.details[0].location, 'body')
  })

  it('rejects an invalid date when creating a transaction', async () => {
    const response = await request(app)
      .post(`${ACCOUNTS}/${MAIN}/transactions`)
      .send({ type: 'DEBIT', amount: 5, postingDate: '2024-02-30' })
    assert.equal(response.statusCode, 400)
    assert.equal(response.body.errorMessage, 'postingDate: must be a valid calendar date')
  })

  it('validates the transactions query', async () => {
    const bad = await request(app).get(`${ACCOUNTS}/${MAIN}/transactions?fromDate=yesterday`)
    assert.equal(bad.statusCode, 400)
    assert.equal(bad.body.errorMessage, 'fromDate: must use YYYY-MM-DD format')

    const backwards = await request(app).get(
      `${ACCOUNTS}/${MAIN}/transactions?fromDate=2024-05-01&toDate=2024-01-01`,
    )
    assert.equal(backwards.statusCode, 400)
    assert.equal(backwards.body.errorMessage, 'toDate: must be on or after fromDate')
  })

  it('allows at most 50 transfers per request, like the real API', async () => {
    const leg = { beneficiaryAccountId: SAVER, amount: 1, myReference: 'a', theirReference: 'b' }
    const response = await request(app)
      .post(`${ACCOUNTS}/${MAIN}/transfermultiple`)
      .send({ transferList: Array.from({ length: 51 }, () => leg) })
    assert.equal(response.statusCode, 400)
    assert.equal(response.body.errorMessage, 'transferList: must contain at most 50 transfers')
  })

  it('accepts amounts sent as numeric strings', async () => {
    const accountId = 'test-validation-string-amount'
    await request(app).delete(`${ACCOUNTS}/${accountId}`)
    await request(app).post(ACCOUNTS).send({ accountId, accountNumber: '90000000001' })
    const response = await request(app).post(`${ACCOUNTS}/${accountId}/topup`).send({ amount: '12.50' })
    assert.equal(response.statusCode, 200)
    const balance = await request(app).get(`${ACCOUNTS}/${accountId}/balance`)
    assert.equal(balance.body.data.currentBalance, 12.5)
    await request(app).delete(`${ACCOUNTS}/${accountId}`)
  })

  it('reports every problem in the body', async () => {
    const response = await request(app)
      .post('/za/v1/cards/700615/code/execute-live')
      .send({ currencyCode: 'RAND', centsAmount: -1, merchantCode: 'shop', merchantName: '', merchantCity: 'CT', countryCode: 'ZAF' })
    assert.equal(response.statusCode, 400)
    assert.deepEqual(
      response.body.details.map((d: { path: string }) => d.path).sort(),
      ['centsAmount', 'countryCode', 'currencyCode', 'merchantCode', 'merchantName'],
    )
    assert.match(response.body.errorMessage, /\(and 4 more\)$/)
  })

  it('treats a request with no body as empty, not as a server error', async () => {
    const response = await request(app).post('/za/v1/cards/700615/toggle-programmable-feature')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body, { Enabled: false })
    await request(app).post('/za/v1/cards/700615/toggle-programmable-feature').send({ Enabled: true })
  })

  it('answers malformed JSON with a 400', async () => {
    const response = await request(app)
      .post(`${ACCOUNTS}/${MAIN}/topup`)
      .set('Content-Type', 'application/json')
      .send('{"amount": ')
    assert.equal(response.statusCode, 400)
    assert.equal(response.body.errorMessage, 'Request body is not valid JSON')
  })

  it('answers a token request with no body with a 400, not a 500', async () => {
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', `Basic ${Buffer.from('yAxzQRFX97vOcyQAwluEU6H6ePxMA5eY:4dY0PjEYqoBrZ99r').toString('base64')}`)
    assert.equal(response.statusCode, 400)
  })
})

describe('Settings', () => {
  let original: Record<string, unknown>

  beforeAll(async () => {
    original = (await request(app).get('/envs')).body.data
  })

  afterAll(async () => {
    await request(app).post('/envs').send(original)
  })

  it('rejects incomplete settings', async () => {
    const response = await request(app).post('/envs').send({ client_id: 'x' })
    assert.equal(response.statusCode, 400)
    assert.deepEqual(
      response.body.details.map((d: { path: string }) => d.path).sort(),
      ['api_key', 'auth', 'client_secret', 'token_expiry'],
    )
  })

  it('saves settings with real types', async () => {
    const response = await request(app)
      .post('/envs')
      .send({ ...original, token_expiry: '600', auth: 'false' })
    assert.equal(response.statusCode, 200)
    assert.strictEqual(response.body.token_expiry, 600)
    assert.strictEqual(response.body.auth, false)
    const read = await request(app).get('/envs')
    assert.strictEqual(read.body.data.token_expiry, 600)
  })
})
