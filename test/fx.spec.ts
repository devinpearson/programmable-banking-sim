import request from 'supertest'
import { assert } from 'chai'
import { app } from './app-server'

// Foreign card swipes are charged in rand at the sandbox exchange rate
// (prisma/exchange-rate.ts: USD = R17.60), and new cards can be issued
// against an account.
const ACCOUNT_ID = 'test-fx-account-001'
const ACCOUNTS = '/za/pb/v1/accounts'
const CARDS = '/za/v1/cards'

const swipe = (cardKey: string, currencyCode: string, centsAmount: number, merchantName = 'Shop') =>
  request(app).post(`${CARDS}/${cardKey}/code/execute-live`).send({
    currencyCode,
    centsAmount,
    merchantCode: '5411',
    merchantName,
    merchantCity: 'London',
    countryCode: 'GB',
  })

describe('New cards', () => {
  beforeEach(async () => {
    await request(app).delete(`${ACCOUNTS}/${ACCOUNT_ID}`)
    await request(app).post(ACCOUNTS).send({ accountId: ACCOUNT_ID, accountNumber: '70000000001' })
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 1000 })
  })

  afterAll(async () => {
    await request(app).delete(`${ACCOUNTS}/${ACCOUNT_ID}`)
  })

  it('issues a card on an account with defaults that swipe straight away', async () => {
    const created = await request(app).post(CARDS).send({ accountId: ACCOUNT_ID, isProgrammable: true })
    assert.equal(created.statusCode, 200)
    const card = created.body.data
    assert.equal(card.accountId, ACCOUNT_ID)
    assert.equal(card.accountNumber, '70000000001')
    assert.match(card.cardNumber, /^402167XXXXXX\d{4}$/)
    assert.equal(card.status, 'Active')

    const published = await request(app).get(`${CARDS}/${card.cardKey}/publishedcode`)
    assert.include(published.body.data.cardCode.code, 'const beforeTransaction')

    const approved = await swipe(card.cardKey, 'ZAR', 5000)
    assert.isTrue(approved.body.data.result)
    assert.equal(approved.body.data.transaction.accountId, ACCOUNT_ID)
  })

  it('refuses an account that does not exist', async () => {
    const response = await request(app).post(CARDS).send({ accountId: 'no-such-account' })
    assert.equal(response.statusCode, 422)
    assert.equal(response.body.errorMessage, 'No account with id no-such-account')
  })

  it('explains a duplicate card key', async () => {
    await request(app).post(CARDS).send({ cardKey: 'test-fx-dup', accountId: ACCOUNT_ID })
    const again = await request(app).post(CARDS).send({ cardKey: 'test-fx-dup', accountId: ACCOUNT_ID })
    assert.equal(again.statusCode, 409)
    assert.equal(again.body.errorMessage, 'A card with key test-fx-dup already exists')
  })
})

describe('Foreign currency swipes', () => {
  let cardKey: string

  beforeEach(async () => {
    await request(app).delete(`${ACCOUNTS}/${ACCOUNT_ID}`)
    await request(app).post(ACCOUNTS).send({ accountId: ACCOUNT_ID, accountNumber: '70000000001' })
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 1000 })
    cardKey = (await request(app).post(CARDS).send({ accountId: ACCOUNT_ID })).body.data.cardKey
  })

  afterAll(async () => {
    await request(app).delete(`${ACCOUNTS}/${ACCOUNT_ID}`)
    await request(app).delete('/exchange-rates/XYZ')
  })

  it('lists the seeded exchange rates', async () => {
    const response = await request(app).get('/exchange-rates')
    assert.equal(response.statusCode, 200)
    const usd = response.body.data.rates.find((r: { currencyCode: string }) => r.currencyCode === 'USD')
    assert.equal(usd.zarPerUnit, 17.6)
  })

  it('charges a foreign purchase in rand at the exchange rate', async () => {
    const response = await swipe(cardKey, 'USD', 1250, 'London Books')
    assert.isTrue(response.body.data.result)
    assert.deepEqual(response.body.data.exchange, {
      currencyCode: 'USD',
      amount: 12.5,
      zarPerUnit: 17.6,
      zarAmount: 220,
    })
    const hold = response.body.data.transaction
    assert.equal(hold.amount, '220')
    assert.equal(hold.description, 'London Books (USD 12.50)')

    const balance = await request(app).get(`${ACCOUNTS}/${ACCOUNT_ID}/balance`)
    assert.equal(balance.body.data.availableBalance, 780)
  })

  it('shows the card code the purchase in its own currency', async () => {
    await swipe(cardKey, 'usd', 1250)
    const executions = await request(app).get(`${CARDS}/${cardKey}/code/executions`)
    const before = executions.body.data.executions.find((e: { type: string }) => e.type === 'before_transaction')
    const authorization = JSON.parse(before.logs[0].content)
    assert.equal(authorization.currencyCode, 'usd')
    assert.equal(authorization.centsAmount, 1250)
  })

  it('checks the funds against the converted amount', async () => {
    // USD 60 = R1,056, more than the R1,000 available.
    const response = await swipe(cardKey, 'USD', 6000)
    assert.isFalse(response.body.data.result)
    assert.equal(response.body.data.reason, 'insufficient_funds')
    assert.equal(response.body.data.exchange.zarAmount, 1056)
  })

  it('needs a rate before a currency can be used, and any currency can get one', async () => {
    const refused = await swipe(cardKey, 'XYZ', 100)
    assert.equal(refused.statusCode, 422)
    assert.equal(refused.body.errorMessage, 'No exchange rate for XYZ. Add one with PUT /exchange-rates/XYZ.')

    const added = await request(app).put('/exchange-rates/xyz').send({ zarPerUnit: 2.5 })
    assert.equal(added.statusCode, 200)
    assert.equal(added.body.data.currencyCode, 'XYZ')

    const approved = await swipe(cardKey, 'XYZ', 400)
    assert.isTrue(approved.body.data.result)
    assert.equal(approved.body.data.exchange.zarAmount, 10)
  })

  it('validates rate changes', async () => {
    assert.equal((await request(app).put('/exchange-rates/ZAR').send({ zarPerUnit: 2 })).statusCode, 400)
    assert.equal((await request(app).put('/exchange-rates/DOLLARS').send({ zarPerUnit: 2 })).statusCode, 400)
    assert.equal((await request(app).put('/exchange-rates/USD').send({ zarPerUnit: 0 })).statusCode, 400)
    assert.equal((await request(app).delete('/exchange-rates/QQQ')).statusCode, 404)
  })

  it('leaves rand swipes unconverted', async () => {
    const response = await swipe(cardKey, 'ZAR', 1000)
    assert.isNull(response.body.data.exchange)
    assert.equal(response.body.data.transaction.description, 'Shop')
  })
})
