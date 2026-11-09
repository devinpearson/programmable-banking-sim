import request from 'supertest'
import { app } from '../src/app'
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

  it('should serve the root page', async () => {
    const response = await request(app).get('/')
    assert.equal(response.statusCode, 200)
    assert.match(response.headers['content-type'], /html/)
  })

  it('should serve the login page', async () => {
    const response = await request(app).get('/login')
    assert.equal(response.statusCode, 200)
    assert.match(response.headers['content-type'], /html/)
  })

  it('should redirect to the oauth consent page on successful login', async () => {
    const response = await request(app)
      .post('/login')
      .send({ email: 'admin@example.com', password: 'admin' })
    assert.equal(response.statusCode, 302)
    assert.equal(
      response.headers.location,
      '/wpaas/prog-banking-wpaas/oauth-consent',
    )
  })

  it('should preserve the qsp parameter when redirecting after successful login', async () => {
    const response = await request(app)
      .post('/login?qsp=abc123')
      .send({ email: 'admin@example.com', password: 'admin' })
    assert.equal(response.statusCode, 302)
    assert.equal(
      response.headers.location,
      '/wpaas/prog-banking-wpaas/oauth-consent?qsp=abc123',
    )
  })

  it('should redirect back to login on failed login', async () => {
    const response = await request(app)
      .post('/login')
      .send({ email: 'wrong@example.com', password: 'wrong' })
    assert.equal(response.statusCode, 302)
    assert.equal(response.headers.location, '/login')
  })

  it('should serve the oauth consent page', async () => {
    const response = await request(app).get(
      '/wpaas/prog-banking-wpaas/oauth-consent',
    )
    assert.equal(response.statusCode, 200)
    assert.match(response.headers['content-type'], /html/)
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
})
