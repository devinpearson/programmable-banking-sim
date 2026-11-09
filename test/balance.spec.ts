import request from 'supertest'
import { app } from '../src/app'
import { assert } from 'chai'

// Card swipes, pending holds, overdraft limits and insufficient-funds checks.
const ACCOUNT_ID = 'test-balance-account-001'
const OTHER_ACCOUNT_ID = 'test-balance-account-002'
const CARD_KEY = 'test-balance-card-001'
const APPROVE_CODE =
  'const beforeTransaction = async (authorization) => { return true; };\n' +
  'const afterTransaction = async (transaction) => { console.log(transaction); };'

const swipe = (centsAmount: number, merchantName = 'Corner Cafe', extra = {}) =>
  request(app).post(`/za/v1/cards/${CARD_KEY}/code/execute-live`).send({
    currencyCode: 'ZAR',
    centsAmount,
    merchantCode: '5814',
    merchantName,
    merchantCity: 'Cape Town',
    countryCode: 'ZA',
    ...extra,
  })

const balanceOf = async (accountId: string) =>
  (await request(app).get(`/za/pb/v1/accounts/${accountId}/balance`)).body.data

describe('Balances, card holds and overdrafts', () => {
  beforeEach(async () => {
    await request(app).delete(`/za/v1/cards/${CARD_KEY}`)
    await request(app).delete(`/za/pb/v1/accounts/${ACCOUNT_ID}`)
    await request(app).delete(`/za/pb/v1/accounts/${OTHER_ACCOUNT_ID}`)
    await request(app)
      .post('/za/pb/v1/accounts')
      .send({ accountId: ACCOUNT_ID, accountNumber: '55555555501', overdraftLimit: 500 })
    await request(app)
      .post('/za/pb/v1/accounts')
      .send({ accountId: OTHER_ACCOUNT_ID, accountNumber: '55555555502' })
    await request(app).post(`/za/pb/v1/accounts/${ACCOUNT_ID}/topup`).send({ amount: 1000 })
    await request(app).post('/za/v1/cards').send({
      cardKey: CARD_KEY,
      cardNumber: '402167XXXXXX2222',
      accountId: ACCOUNT_ID,
      accountNumber: '55555555501',
      isProgrammable: true,
    })
    await request(app)
      .post(`/za/v1/cards/${CARD_KEY}/publishedcode`)
      .send({ code: APPROVE_CODE })
  })

  afterAll(async () => {
    await request(app).delete(`/za/v1/cards/${CARD_KEY}`)
    await request(app).delete(`/za/pb/v1/accounts/${ACCOUNT_ID}`)
    await request(app).delete(`/za/pb/v1/accounts/${OTHER_ACCOUNT_ID}`)
  })

  it('counts the overdraft limit in the available balance', async () => {
    const balance = await balanceOf(ACCOUNT_ID)
    assert.equal(balance.currentBalance, 1000)
    assert.equal(balance.availableBalance, 1500)
  })

  it('keeps the overdraft limit out of the accounts list', async () => {
    const response = await request(app).get('/za/pb/v1/accounts')
    const account = response.body.data.accounts.find(
      (a: { accountId: string }) => a.accountId === ACCOUNT_ID,
    )
    assert.exists(account)
    assert.notProperty(account, 'overdraftLimit')
  })

  it('places a pending CardPurchases hold for an approved swipe', async () => {
    const response = await swipe(25050)
    assert.equal(response.statusCode, 200)
    assert.isTrue(response.body.data.result)
    const hold = response.body.data.transaction
    assert.equal(hold.accountId, ACCOUNT_ID)
    assert.equal(hold.status, 'PENDING')
    assert.equal(hold.type, 'DEBIT')
    assert.equal(hold.transactionType, 'CardPurchases')
    assert.equal(hold.description, 'Corner Cafe')
    assert.equal(hold.cardNumber, '402167XXXXXX2222')

    // A hold reduces what can be spent, not the current balance.
    const balance = await balanceOf(ACCOUNT_ID)
    assert.equal(balance.currentBalance, 1000)
    assert.equal(balance.availableBalance, 1249.5)

    const pending = await request(app).get(
      `/za/pb/v1/accounts/${ACCOUNT_ID}/pending-transactions`,
    )
    assert.equal(pending.statusCode, 200)
    assert.lengthOf(pending.body.data.pendingTransactions, 1)
    assert.equal(pending.body.data.pendingTransactions[0].transactionId, hold.transactionId)
  })

  it('lists pending transactions only with includePending=true', async () => {
    await swipe(10000)
    const posted = await request(app).get(`/za/pb/v1/accounts/${ACCOUNT_ID}/transactions`)
    assert.isTrue(
      posted.body.data.transactions.every((t: { status: string }) => t.status === 'POSTED'),
    )
    const all = await request(app).get(
      `/za/pb/v1/accounts/${ACCOUNT_ID}/transactions?includePending=true`,
    )
    const pending = all.body.data.transactions.filter(
      (t: { status: string }) => t.status === 'PENDING',
    )
    assert.lengthOf(pending, 1)
    assert.equal(pending[0].runningBalance, 0)
  })

  it('posts a hold to the current balance when it settles', async () => {
    const hold = (await swipe(20000)).body.data.transaction
    const settled = await request(app).post(
      `/za/pb/v1/accounts/${ACCOUNT_ID}/pending-transactions/${hold.transactionId}/settle`,
    )
    assert.equal(settled.statusCode, 200)
    assert.equal(settled.body.data.status, 'POSTED')
    assert.isNotEmpty(settled.body.data.postingDate)

    const balance = await balanceOf(ACCOUNT_ID)
    assert.equal(balance.currentBalance, 800)
    assert.equal(balance.availableBalance, 1300)

    // Settling twice is a 404: it is no longer pending.
    const again = await request(app).post(
      `/za/pb/v1/accounts/${ACCOUNT_ID}/pending-transactions/${hold.transactionId}/settle`,
    )
    assert.equal(again.statusCode, 404)
  })

  it('posts a swipe straight away with settle: true', async () => {
    const response = await swipe(20000, 'Settled Store', { settle: true })
    assert.isTrue(response.body.data.result)
    const transaction = response.body.data.transaction
    assert.equal(transaction.status, 'POSTED')
    assert.equal(transaction.transactionType, 'CardPurchases')
    assert.isNotEmpty(transaction.postingDate)

    const balance = await balanceOf(ACCOUNT_ID)
    assert.equal(balance.currentBalance, 800)
    assert.equal(balance.availableBalance, 1300)
    const pending = await request(app).get(
      `/za/pb/v1/accounts/${ACCOUNT_ID}/pending-transactions`,
    )
    assert.lengthOf(pending.body.data.pendingTransactions, 0)
  })

  it('inserts posted card transactions through the transactions endpoint', async () => {
    for (const body of [
      { type: 'DEBIT', transactionType: 'CardPurchases', amount: 100 },
      { type: 'DEBIT', transactionType: 'CardPurchases', status: 'POSTED', amount: 100 },
      { type: 'DEBIT', transactionType: 'CardWithdrawals', status: 'POSTED', amount: 100 },
    ]) {
      const response = await request(app)
        .post(`/za/pb/v1/accounts/${ACCOUNT_ID}/transactions`)
        .send(body)
      assert.equal(response.statusCode, 200)
      assert.equal(response.body.data.status, 'POSTED')
    }
    const balance = await balanceOf(ACCOUNT_ID)
    assert.equal(balance.currentBalance, 700)
  })

  it('releases the funds when a hold is reversed', async () => {
    const hold = (await swipe(20000)).body.data.transaction
    const reversed = await request(app).delete(
      `/za/pb/v1/accounts/${ACCOUNT_ID}/pending-transactions/${hold.transactionId}`,
    )
    assert.equal(reversed.statusCode, 200)
    const balance = await balanceOf(ACCOUNT_ID)
    assert.equal(balance.availableBalance, 1500)
  })

  it('declines a swipe the available balance cannot cover', async () => {
    const response = await swipe(150001) // R1,500.01 vs R1,500 available
    assert.equal(response.statusCode, 200)
    assert.isFalse(response.body.data.result)
    assert.equal(response.body.data.reason, 'insufficient_funds')
    assert.isNull(response.body.data.transaction)
    const balance = await balanceOf(ACCOUNT_ID)
    assert.equal(balance.availableBalance, 1500)
  })

  it('places no hold when the card code declines', async () => {
    await request(app)
      .post(`/za/v1/cards/${CARD_KEY}/publishedcode`)
      .send({ code: 'const beforeTransaction = async () => { return false; };' })
    const response = await swipe(1000)
    assert.isFalse(response.body.data.result)
    assert.isNull(response.body.data.transaction)
    const pending = await request(app).get(
      `/za/pb/v1/accounts/${ACCOUNT_ID}/pending-transactions`,
    )
    assert.lengthOf(pending.body.data.pendingTransactions, 0)
  })

  it('rejects a swipe with an invalid amount', async () => {
    const response = await swipe(0)
    assert.equal(response.statusCode, 400)
  })

  it('allows a transfer into the overdraft but not beyond it', async () => {
    const transfer = (amount: number) =>
      request(app)
        .post(`/za/pb/v1/accounts/${ACCOUNT_ID}/transfermultiple`)
        .send({
          transferList: [
            { beneficiaryAccountId: OTHER_ACCOUNT_ID, amount, myReference: 'out', theirReference: 'in' },
          ],
        })
    const tooMuch = await transfer(1500.01)
    assert.equal(tooMuch.statusCode, 422)
    assert.equal(tooMuch.body.errorMessage, 'Insufficient funds')

    const intoOverdraft = await transfer(1200)
    assert.equal(intoOverdraft.statusCode, 200)
    const balance = await balanceOf(ACCOUNT_ID)
    assert.equal(balance.currentBalance, -200)
    assert.equal(balance.availableBalance, 300)
  })

  it('checks the whole payment batch against the available balance', async () => {
    const response = await request(app)
      .post(`/za/pb/v1/accounts/${ACCOUNT_ID}/paymultiple`)
      .send({
        paymentList: [
          { beneficiaryId: 'MTAxOTA2OTI5Nzc0Mjz=', amount: 1000, myReference: 'one' },
          { beneficiaryId: 'MTAxOTA2OTI5Nzc0Mjz=', amount: 600, myReference: 'two' },
        ],
      })
    assert.equal(response.statusCode, 422)
    // Nothing was written.
    const balance = await balanceOf(ACCOUNT_ID)
    assert.equal(balance.currentBalance, 1000)
  })

  it('404s pending actions for an unknown transaction or account', async () => {
    const settle = await request(app).post(
      `/za/pb/v1/accounts/${ACCOUNT_ID}/pending-transactions/999999/settle`,
    )
    assert.equal(settle.statusCode, 404)
    const list = await request(app).get('/za/pb/v1/accounts/does-not-exist/pending-transactions')
    assert.equal(list.statusCode, 404)
  })
})
