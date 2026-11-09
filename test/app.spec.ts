import request from 'supertest'
import { app } from './app-server'
import { assert } from 'chai'

describe('Test the app-level routes', () => {
  it('should respond with ok on the health check', async () => {
    const response = await request(app).get('/health')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body, { status: 'ok' })
  })

  it('should respond with the current environment settings', async () => {
    const response = await request(app).get('/envs')
    assert.equal(response.statusCode, 200)
    assert.property(response.body.data, 'client_id')
    assert.property(response.body.data, 'client_secret')
    assert.property(response.body.data, 'api_key')
    assert.property(response.body.data, 'token_expiry')
    assert.property(response.body.data, 'auth')
  })

  // The pages are the Next.js app in web/ (WEB_URL, http://localhost:3001 by
  // default); the API redirects its old page URLs there.
  it('should redirect the old page URLs to the web app, keeping the query', async () => {
    for (const [path, target] of [
      ['/', 'http://localhost:3001/'],
      ['/login?qsp=abc', 'http://localhost:3001/login?qsp=abc'],
      ['/wpaas/prog-banking-wpaas/oauth-consent?qsp=abc', 'http://localhost:3001/consent?qsp=abc'],
      ['/guide', 'http://localhost:3001/guide'],
    ]) {
      const response = await request(app).get(path)
      assert.equal(response.statusCode, 302, path)
      assert.equal(response.headers.location, target, path)
    }
  })

  it('should redirect to the consent page on successful login', async () => {
    const response = await request(app)
      .post('/login')
      .send({ email: 'admin@example.com', password: 'admin' })
    assert.equal(response.statusCode, 302)
    assert.equal(response.headers.location, 'http://localhost:3001/consent')
  })

  it('should preserve the qsp parameter when redirecting after successful login', async () => {
    const response = await request(app)
      .post('/login?qsp=abc123')
      .send({ email: 'admin@example.com', password: 'admin' })
    assert.equal(response.statusCode, 302)
    assert.equal(response.headers.location, 'http://localhost:3001/consent?qsp=abc123')
  })

  it('should take the qsp from a form post, as the login page sends it', async () => {
    const response = await request(app)
      .post('/login')
      .type('form')
      .send({ email: 'admin@example.com', password: 'admin', qsp: 'from-form' })
    assert.equal(response.headers.location, 'http://localhost:3001/consent?qsp=from-form')
  })

  it('should redirect back to login with an error on failed login', async () => {
    const response = await request(app)
      .post('/login?qsp=abc123')
      .send({ email: 'wrong@example.com', password: 'wrong' })
    assert.equal(response.statusCode, 302)
    assert.equal(
      response.headers.location,
      'http://localhost:3001/login?error=invalid_credentials&qsp=abc123',
    )
  })

  it('should respond with 404 for legacy /oauth endpoints', async () => {
    const response = await request(app).get('/oauth/anything')
    assert.equal(response.statusCode, 404)
    assert.equal(response.body.error, 'endpoint_not_found')
  })

  it('should clear the database and fully restore it from the seed', async () => {
    const clearResponse = await request(app).delete('/clear')
    assert.equal(clearResponse.statusCode, 200)

    const emptied = await request(app).get('/database-summary')
    assert.equal(emptied.body.data.profiles, 0)
    assert.equal(emptied.body.data.accounts, 0)
    assert.equal(emptied.body.data.cards, 0)
    assert.equal(emptied.body.data.transactions, 0)

    const restoreResponse = await request(app).get('/restore')
    assert.equal(restoreResponse.statusCode, 200)

    // Restore must repopulate every seeded table, not just a subset.
    const restored = await request(app).get('/database-summary')
    assert.isAbove(restored.body.data.profiles, 0)
    assert.isAbove(restored.body.data.accounts, 0)
    assert.isAbove(restored.body.data.cards, 0)
    assert.isAbove(restored.body.data.transactions, 0)
  })

  it('should list the available scenarios', async () => {
    const response = await request(app).get('/scenarios')
    assert.equal(response.statusCode, 200)
    assert.isArray(response.body.data)
    assert.isAbove(response.body.data.length, 0)
    const starter = response.body.data.find((s: { id: string }) => s.id === 'starter')
    assert.exists(starter)
    assert.exists(starter.name)
    assert.exists(starter.description)
  })

  it('should respond with 404 for an unknown scenario', async () => {
    const response = await request(app).post('/scenarios/does-not-exist')
    assert.equal(response.statusCode, 404)
  })

  it('should load a scenario and set its opening balances', async () => {
    const response = await request(app).post('/scenarios/overdrawn')
    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.id, 'overdrawn')
    assert.equal(response.body.data.accounts, 2)

    // overdrawn scenario: current account -2500, savings 15000
    const current = await request(app).get('/za/pb/v1/accounts/30000000000000000000011/balance')
    assert.equal(current.body.data.currentBalance, -2500)
    const savings = await request(app).get('/za/pb/v1/accounts/30000000000000000000012/balance')
    assert.equal(savings.body.data.currentBalance, 15000)

    // Restore the canonical seed so later tests see normal data.
    const restoreResponse = await request(app).get('/restore')
    assert.equal(restoreResponse.statusCode, 200)
  })

  it('should issue scenario cards that swipe against scenario accounts', async () => {
    const response = await request(app).post('/scenarios/hackathon')
    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.cards, 1)

    // Only the scenario's card remains, linked to its cheque account.
    const cards = await request(app).get('/za/v1/cards')
    assert.deepEqual(
      cards.body.data.cards.map((c: { CardKey: string; AccountId: string }) => [c.CardKey, c.AccountId]),
      [['scenario-card-021', '30000000000000000000021']],
    )

    const swipe = await request(app)
      .post('/za/v1/cards/scenario-card-021/code/execute-live')
      .send({ currencyCode: 'ZAR', centsAmount: 50000, merchantCode: '5411', merchantName: 'Scenario Shop', merchantCity: 'Cape Town', countryCode: 'ZA' })
    assert.isTrue(swipe.body.data.result)
    assert.equal(swipe.body.data.transaction.accountId, '30000000000000000000021')

    const balance = await request(app).get('/za/pb/v1/accounts/30000000000000000000021/balance')
    assert.equal(balance.body.data.currentBalance, 25000)
    assert.equal(balance.body.data.availableBalance, 24500)

    const restoreResponse = await request(app).get('/restore')
    assert.equal(restoreResponse.statusCode, 200)
  })
})
