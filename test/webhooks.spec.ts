import request from 'supertest'
import { assert } from 'chai'
import { createHmac } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { app } from './app-server'
import { settleWebhookDeliveries } from '../src/webhooks'

// Webhooks deliver to a real HTTP receiver on 127.0.0.1. Retries use short
// delays here (read when each delivery starts).
process.env.WEBHOOK_RETRY_DELAYS_MS = '20,40,80'
const ACCOUNT_ID = 'test-webhook-account-001'
const OTHER_ID = 'test-webhook-account-002'
const ACCOUNTS = '/za/pb/v1/accounts'
const SECRET = 'sandbox-secret-123'

interface Received {
  headers: http.IncomingHttpHeaders
  body: string
  json: { id: string; event: string; createdAt: string; data: Record<string, unknown> }
}

let receiver: http.Server
let receiverUrl: string
let received: Received[] = []
let respondWith = 200
// Answer the first N deliveries with 503, then respondWith.
let failFirst = 0

beforeAll(async () => {
  receiver = http.createServer((req, res) => {
    let body = ''
    req.on('data', chunk => (body += chunk))
    req.on('end', () => {
      received.push({ headers: req.headers, body, json: JSON.parse(body) })
      res.statusCode = received.length <= failFirst ? 503 : respondWith
      res.end('ok')
    })
  })
  await new Promise<void>(resolve => receiver.listen(0, '127.0.0.1', resolve))
  receiverUrl = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}/hook`
})

afterAll(async () => {
  await settleWebhookDeliveries()
  await new Promise<void>(resolve => receiver.close(() => resolve()))
})

async function removeAllWebhooks() {
  const { body } = await request(app).get('/webhooks')
  for (const webhook of body.data.webhooks) {
    await request(app).delete(`/webhooks/${webhook.webhookId}`)
  }
}

async function register(body: Record<string, unknown>) {
  const response = await request(app).post('/webhooks').send(body)
  assert.equal(response.statusCode, 200, JSON.stringify(response.body))
  return response.body.data
}

const ofEvent = (event: string) => received.filter(r => r.json.event === event)

// A port with nothing listening: open one, note it, close it.
async function closedPort(): Promise<number> {
  const server = http.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  await new Promise<void>(resolve => server.close(() => resolve()))
  return port
}

beforeEach(async () => {
  await settleWebhookDeliveries()
  await removeAllWebhooks()
  received = []
  respondWith = 200
  failFirst = 0
  process.env.WEBHOOK_RETRY_DELAYS_MS = '20,40,80'
  await request(app).delete(`${ACCOUNTS}/${ACCOUNT_ID}`)
  await request(app).delete(`${ACCOUNTS}/${OTHER_ID}`)
  await request(app).post(ACCOUNTS).send({ accountId: ACCOUNT_ID, accountNumber: '80000000001' })
  await request(app).post(ACCOUNTS).send({ accountId: OTHER_ID, accountNumber: '80000000002' })
})

afterAll(async () => {
  await removeAllWebhooks()
  await request(app).delete(`${ACCOUNTS}/${ACCOUNT_ID}`)
  await request(app).delete(`${ACCOUNTS}/${OTHER_ID}`)
})

describe('Webhook registration', () => {
  it('registers a webhook for every event by default, without echoing the secret', async () => {
    const webhook = await register({ url: receiverUrl, secret: SECRET })
    assert.deepEqual(webhook.events, ['*'])
    assert.isTrue(webhook.hasSecret)
    assert.notProperty(webhook, 'secret')
    assert.isTrue(webhook.active)

    const list = await request(app).get('/webhooks')
    assert.equal(list.body.data.webhooks.length, 1)
  })

  it('lists the events it can deliver', async () => {
    const response = await request(app).get('/webhooks/events')
    assert.deepEqual(response.body.data.events, [
      'transaction.posted',
      'transaction.pending',
      'transaction.reversed',
      'card.authorization',
    ])
  })

  it('validates the URL, events and secret', async () => {
    const badUrl = await request(app).post('/webhooks').send({ url: 'ftp://example.com/x' })
    assert.equal(badUrl.statusCode, 400)
    assert.equal(badUrl.body.errorMessage, 'url: must be an http or https URL')
    const badEvent = await request(app).post('/webhooks').send({ url: receiverUrl, events: ['card.swiped'] })
    assert.equal(badEvent.statusCode, 400)
    const shortSecret = await request(app).post('/webhooks').send({ url: receiverUrl, secret: 'abc' })
    assert.equal(shortSecret.body.errorMessage, 'secret: must be at least 8 characters')
  })

  it('404s for an unknown webhook', async () => {
    assert.equal((await request(app).delete('/webhooks/nope')).statusCode, 404)
    assert.equal((await request(app).post('/webhooks/nope/test')).statusCode, 404)
    assert.equal((await request(app).patch('/webhooks/nope').send({ active: false })).statusCode, 404)
  })
})

describe('Webhook deliveries', () => {
  it('sends a signed test event on request', async () => {
    const webhook = await register({ url: receiverUrl, secret: SECRET })
    const response = await request(app).post(`/webhooks/${webhook.webhookId}/test`)
    assert.equal(response.body.data.status, 'delivered')
    assert.equal(response.body.data.responseStatus, 200)

    const [delivery] = received
    assert.equal(delivery.json.event, 'webhook.test')
    assert.equal(delivery.headers['x-sandbox-event'], 'webhook.test')
    assert.equal(delivery.headers['x-sandbox-delivery'], delivery.json.id)
    const expected = `sha256=${createHmac('sha256', SECRET).update(delivery.body).digest('hex')}`
    assert.equal(delivery.headers['x-sandbox-signature'], expected)
  })

  it('posts top-ups and both legs of a transfer', async () => {
    await register({ url: receiverUrl, events: ['transaction.posted'] })
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 500 })
    await request(app)
      .post(`${ACCOUNTS}/${ACCOUNT_ID}/transfermultiple`)
      .send({ transferList: [{ beneficiaryAccountId: OTHER_ID, amount: 120, myReference: 'out', theirReference: 'in' }] })
    await settleWebhookDeliveries()

    const posted = ofEvent('transaction.posted').map(r => r.json.data)
    assert.lengthOf(posted, 3)
    assert.deepInclude(
      posted.map(t => [t.accountId, t.type, t.transactionType, t.amount]),
      [ACCOUNT_ID, 'CREDIT', 'Deposits', '500'],
    )
    assert.deepInclude(
      posted.map(t => [t.accountId, t.type, t.description]),
      [OTHER_ID, 'CREDIT', 'in'],
    )
    assert.exists(posted[0].transactionId)
  })

  it('follows a card hold from authorization to settlement', async () => {
    await register({ url: receiverUrl })
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 1000 })
    const card = (await request(app).post('/za/v1/cards').send({ accountId: ACCOUNT_ID })).body.data
    const swipe = await request(app)
      .post(`/za/v1/cards/${card.cardKey}/code/execute-live`)
      .send({ currencyCode: 'USD', centsAmount: 1000, merchantCode: '5411', merchantName: 'Hook Shop', merchantCity: 'NYC', countryCode: 'US' })
    const hold = swipe.body.data.transaction
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/pending-transactions/${hold.transactionId}/settle`)
    await settleWebhookDeliveries()

    const [authorization] = ofEvent('card.authorization').map(r => r.json.data)
    assert.include(authorization, { cardKey: card.cardKey, approved: true, reason: null, currencyCode: 'USD', centsAmount: 1000, zarAmount: 176 })
    assert.equal(authorization.transactionId, hold.transactionId)
    assert.deepEqual(authorization.merchant, { name: 'Hook Shop', city: 'NYC', countryCode: 'US', categoryCode: '5411' })

    const [pending] = ofEvent('transaction.pending').map(r => r.json.data)
    assert.equal(pending.transactionId, hold.transactionId)
    assert.equal(pending.status, 'PENDING')

    const settled = ofEvent('transaction.posted').map(r => r.json.data).find(t => t.transactionId === hold.transactionId)
    assert.equal(settled?.status, 'POSTED')
  })

  it('reports declined swipes and reversed holds', async () => {
    await register({ url: receiverUrl, events: ['card.authorization', 'transaction.reversed'] })
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 50 })
    const card = (await request(app).post('/za/v1/cards').send({ accountId: ACCOUNT_ID })).body.data
    const swipe = (cents: number) =>
      request(app)
        .post(`/za/v1/cards/${card.cardKey}/code/execute-live`)
        .send({ currencyCode: 'ZAR', centsAmount: cents, merchantCode: '5411', merchantName: 'Shop', merchantCity: 'CT', countryCode: 'ZA' })
    await swipe(10000) // R100 > R50 available
    const hold = (await swipe(2000)).body.data.transaction
    await request(app).delete(`${ACCOUNTS}/${ACCOUNT_ID}/pending-transactions/${hold.transactionId}`)
    await settleWebhookDeliveries()

    const decisions = ofEvent('card.authorization').map(r => r.json.data)
    assert.deepEqual(
      decisions.map(d => [d.approved, d.reason]),
      [
        [false, 'insufficient_funds'],
        [true, null],
      ],
    )
    const [reversed] = ofEvent('transaction.reversed').map(r => r.json.data)
    assert.equal(reversed.transactionId, hold.transactionId)
    // Not subscribed: no pending event.
    assert.lengthOf(ofEvent('transaction.pending'), 0)
  })

  it('stops delivering while paused', async () => {
    const webhook = await register({ url: receiverUrl })
    await request(app).patch(`/webhooks/${webhook.webhookId}`).send({ active: false })
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 5 })
    await settleWebhookDeliveries()
    assert.lengthOf(received, 0)
  })

  it('records failed deliveries with the reason', async () => {
    respondWith = 500
    const failing = await register({ url: receiverUrl, events: ['transaction.posted'] })
    const unreachable = await register({ url: `http://127.0.0.1:${await closedPort()}/nobody-home`, events: ['transaction.posted'] })
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 5 })
    await settleWebhookDeliveries()

    const [rejected] = (await request(app).get(`/webhooks/${failing.webhookId}/deliveries`)).body.data.deliveries
    assert.include(rejected, { event: 'transaction.posted', status: 'failed', responseStatus: 500, error: 'Responded 500' })
    assert.equal(rejected.payload.event, 'transaction.posted')

    const [refused] = (await request(app).get(`/webhooks/${unreachable.webhookId}/deliveries`)).body.data.deliveries
    assert.include(refused, { status: 'failed', responseStatus: null, error: 'Connection refused' })
  })
})

describe('Webhook retries', () => {
  it('retries a failed delivery with the same id until it is accepted', async () => {
    failFirst = 2
    const webhook = await register({ url: receiverUrl, events: ['transaction.posted'] })
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 5 })
    await settleWebhookDeliveries()

    assert.lengthOf(received, 3)
    assert.deepEqual(received.map(r => r.headers['x-sandbox-attempt']), ['1', '2', '3'])
    const ids = new Set(received.map(r => r.headers['x-sandbox-delivery']))
    assert.equal(ids.size, 1)
    assert.isTrue(received.every(r => r.json.id === received[0].json.id))

    const deliveries = (await request(app).get(`/webhooks/${webhook.webhookId}/deliveries`)).body.data.deliveries
    assert.deepEqual(
      deliveries.map((d: { attempt: number; status: string }) => [d.attempt, d.status]),
      [
        [3, 'delivered'],
        [2, 'failed'],
        [1, 'failed'],
      ],
    )
    assert.isTrue(deliveries.every((d: { eventId: string }) => d.eventId === received[0].json.id))
  })

  it('gives up after four attempts', async () => {
    respondWith = 500
    await register({ url: receiverUrl, events: ['transaction.posted'] })
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 5 })
    await settleWebhookDeliveries()
    assert.lengthOf(received, 4)
  })

  it('stops retrying once the webhook is paused', async () => {
    respondWith = 500
    process.env.WEBHOOK_RETRY_DELAYS_MS = '300,300,300'
    const webhook = await register({ url: receiverUrl, events: ['transaction.posted'] })
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 5 })
    while (received.length === 0) await new Promise(resolve => setTimeout(resolve, 10))
    await request(app).patch(`/webhooks/${webhook.webhookId}`).send({ active: false })
    await settleWebhookDeliveries()
    assert.lengthOf(received, 1)
  })

  it('does not retry when retries are turned off', async () => {
    respondWith = 500
    process.env.WEBHOOK_RETRY_DELAYS_MS = ''
    await register({ url: receiverUrl, events: ['transaction.posted'] })
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 5 })
    await settleWebhookDeliveries()
    assert.lengthOf(received, 1)
  })

  it('never retries a test send', async () => {
    respondWith = 500
    const webhook = await register({ url: receiverUrl })
    const response = await request(app).post(`/webhooks/${webhook.webhookId}/test`)
    assert.equal(response.body.data.attempt, 1)
    await settleWebhookDeliveries()
    assert.lengthOf(received, 1)
  })
})
