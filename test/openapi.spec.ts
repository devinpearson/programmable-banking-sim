import request from 'supertest'
import { assert } from 'chai'
import { z } from 'zod'
import { app } from './app-server'
import * as schema from '../src/schema/responseSchemas'

const MAIN = '4675778129910189600000003'
const ACCOUNTS = '/za/pb/v1/accounts'

describe('OpenAPI docs', () => {
  it('serves the document as JSON and YAML', async () => {
    const json = await request(app).get('/api-docs.json')
    assert.equal(json.statusCode, 200)
    assert.equal(json.body.openapi, '3.0.3')
    assert.exists(json.body.paths['/za/pb/v1/accounts/{accountId}/balance'].get)

    const yaml = await request(app).get('/api-docs.yaml')
    assert.equal(yaml.statusCode, 200)
    assert.match(yaml.text, /^openapi: 3\.0\.3/m)
  })

  it('marks sandbox-only operations', async () => {
    const { body } = await request(app).get('/api-docs.json')
    assert.equal(body.paths['/za/pb/v1/accounts/{accountId}/topup'].post['x-sandbox-only'], true)
    assert.notProperty(body.paths['/za/pb/v1/accounts/{accountId}/balance'].get, 'x-sandbox-only')
  })

  it('serves Swagger UI', async () => {
    const redirect = await request(app).get('/api-docs')
    assert.equal(redirect.statusCode, 302)
    assert.equal(redirect.headers.location, '/swagger-ui')
    const ui = await request(app).get('/swagger-ui/')
    assert.equal(ui.statusCode, 200)
    assert.match(ui.text, /swagger-ui/)
  })
})

// The documented response shapes must match what the API actually returns.
describe('Responses match the documented schemas', () => {
  function expectShape(schemaToCheck: z.ZodTypeAny, body: unknown) {
    const result = schemaToCheck.safeParse(body)
    assert.isTrue(result.success, result.success ? '' : JSON.stringify(result.error.issues, null, 2))
  }

  it('accounts, balance and transactions', async () => {
    expectShape(schema.envelope(z.object({ accounts: z.array(schema.Account).min(1) })), (await request(app).get(ACCOUNTS)).body)
    expectShape(schema.envelope(schema.Balance), (await request(app).get(`${ACCOUNTS}/${MAIN}/balance`)).body)
    expectShape(
      schema.envelope(z.object({ transactions: z.array(schema.Transaction).min(1) })),
      (await request(app).get(`${ACCOUNTS}/${MAIN}/transactions?fromDate=2022-01-01`)).body,
    )
  })

  it('beneficiaries, categories and documents', async () => {
    expectShape(schema.envelope(z.object({ result: z.array(schema.Beneficiary).min(1) })), (await request(app).get(`${ACCOUNTS}/beneficiaries`)).body)
    expectShape(schema.envelope(z.array(schema.BeneficiaryCategory)), (await request(app).get(`${ACCOUNTS}/beneficiarycategories`)).body)
    expectShape(
      schema.envelope(z.object({ documents: z.array(schema.DocumentSummary) })),
      (await request(app).get(`${ACCOUNTS}/${MAIN}/documents`)).body,
    )
  })

  it('cards, card code and a swipe with its hold', async () => {
    expectShape(schema.envelope(z.object({ cards: z.array(schema.Card).min(1) })), (await request(app).get('/za/v1/cards')).body)
    expectShape(schema.envelope(schema.CardCode), (await request(app).get('/za/v1/cards/700615/code')).body)

    const swipe = await request(app)
      .post('/za/v1/cards/700615/code/execute-live')
      .send({ currencyCode: 'ZAR', centsAmount: 100, merchantCode: '5411', merchantName: 'Docs', merchantCity: 'CT', countryCode: 'ZA' })
    expectShape(schema.envelope(schema.SwipeResult), swipe.body)

    const pending = await request(app).get(`${ACCOUNTS}/${MAIN}/pending-transactions`)
    expectShape(schema.envelope(z.object({ pendingTransactions: z.array(schema.PendingTransaction) })), pending.body)

    const hold = swipe.body.data.transaction
    if (hold) await request(app).delete(`${ACCOUNTS}/${MAIN}/pending-transactions/${hold.transactionId}`)
  })

  it('settings, summary and scenarios', async () => {
    expectShape(schema.envelope(schema.Settings), (await request(app).get('/envs')).body)
    expectShape(schema.envelope(schema.DatabaseSummary), (await request(app).get('/database-summary')).body)
    expectShape(schema.envelope(z.array(schema.Scenario)), (await request(app).get('/scenarios')).body)
  })
})
