import request from 'supertest'
import { assert } from 'chai'
import { app } from './app-server'

// Export the sandbox's data and import it back (src/sandboxState.ts).
const ACCOUNTS = '/za/pb/v1/accounts'
const MAIN = '4675778129910189600000003'

afterAll(async () => {
  // Leave the seed data for other test files.
  await request(app).get('/restore')
})

describe('Export and import', () => {
  it('exports every part of the state as a downloadable file', async () => {
    const response = await request(app).get('/export')
    assert.equal(response.statusCode, 200)
    assert.match(response.headers['content-disposition'], /^attachment; filename="sandbox-\d{4}-\d{2}-\d{2}\.json"$/)
    const state = response.body
    assert.equal(state.version, 1)
    for (const part of ['profiles', 'accounts', 'transactions', 'beneficiaries', 'cards', 'cardCodes', 'exchangeRates']) {
      assert.isAbove(state[part].length, 0, part)
    }
    const main = state.accounts.find((a: { accountId: string }) => a.accountId === MAIN)
    assert.equal(main.overdraftLimit, '50000')
    assert.notProperty(state, 'settings')
  })

  it('restores an export exactly, replacing whatever changed since', async () => {
    await request(app).get('/restore')
    const saved = (await request(app).get('/export')).body
    const balanceBefore = (await request(app).get(`${ACCOUNTS}/${MAIN}/balance`)).body.data

    // Change things: a top-up, a new account, a different rate.
    await request(app).post(`${ACCOUNTS}/${MAIN}/topup`).send({ amount: 999 })
    await request(app).post(ACCOUNTS).send({ accountId: 'test-state-extra', accountNumber: '92000000001' })
    await request(app).put('/exchange-rates/USD').send({ zarPerUnit: 99 })

    const imported = await request(app).post('/import').send(saved)
    assert.equal(imported.statusCode, 200)
    assert.equal(imported.body.data.accounts, saved.accounts.length)

    const balanceAfter = (await request(app).get(`${ACCOUNTS}/${MAIN}/balance`)).body.data
    assert.deepEqual(balanceAfter, balanceBefore)
    assert.equal((await request(app).get(`${ACCOUNTS}/test-state-extra/balance`)).statusCode, 404)
    const usd = (await request(app).get('/exchange-rates')).body.data.rates.find((r: { currencyCode: string }) => r.currencyCode === 'USD')
    assert.equal(usd.zarPerUnit, 17.6)

    // The round trip is exact.
    const again = (await request(app).get('/export')).body
    assert.deepEqual({ ...again, exportedAt: null }, { ...saved, exportedAt: null })
  })

  it('keeps card code and pending holds working after an import', async () => {
    await request(app).get('/restore')
    const swipe = await request(app)
      .post('/za/v1/cards/700615/code/execute-live')
      .send({ currencyCode: 'ZAR', centsAmount: 1234, merchantCode: '5411', merchantName: 'Kept', merchantCity: 'CT', countryCode: 'ZA' })
    const hold = swipe.body.data.transaction
    const saved = (await request(app).get('/export')).body
    await request(app).get('/restore')
    await request(app).post('/import').send(saved)

    const settled = await request(app).post(`${ACCOUNTS}/${MAIN}/pending-transactions/${hold.transactionId}/settle`)
    assert.equal(settled.statusCode, 200)
    const code = await request(app).get('/za/v1/cards/700615/publishedcode')
    assert.include(code.body.data.cardCode.code, 'beforeTransaction')
  })

  it('rejects a file it cannot load, changing nothing', async () => {
    await request(app).get('/restore')
    const saved = (await request(app).get('/export')).body
    const accountsBefore = (await request(app).get(ACCOUNTS)).body.data.accounts.length

    const wrongVersion = await request(app).post('/import').send({ ...saved, version: 2 })
    assert.equal(wrongVersion.statusCode, 400)
    assert.equal(wrongVersion.body.errorMessage, 'version: must be 1')

    const orphan = { ...saved, accounts: saved.accounts.filter((a: { accountId: string }) => a.accountId !== MAIN) }
    const orphaned = await request(app).post('/import').send(orphan)
    assert.equal(orphaned.statusCode, 400)
    assert.match(orphaned.body.errorMessage, new RegExp(`no account ${MAIN} in this file`))

    assert.equal((await request(app).get(ACCOUNTS)).body.data.accounts.length, accountsBefore)
  })
})
