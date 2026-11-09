import request from 'supertest'
import { assert } from 'chai'
import { app } from './app-server'

// Sign-in and /identity are rate limited (src/middleware/rateLimit.ts):
// 300 requests per minute per IP by default. This file has its own app
// instance, so its counter starts at zero.
describe('Sign-in rate limit', () => {
  it('answers 429 with Retry-After once the limit is used up', async () => {
    for (let i = 0; i < 300; i++) {
      const attempt = await request(app).post('/login').send({ email: 'x@example.com', password: 'guess' })
      assert.equal(attempt.statusCode, 302, `attempt ${i + 1}`)
    }
    const limited = await request(app).post('/login').send({ email: 'x@example.com', password: 'guess' })
    assert.equal(limited.statusCode, 429)
    assert.equal(limited.body.errorMessage, 'Too many sign-in attempts. Try again in a minute.')
    assert.exists(limited.headers['retry-after'])

    // The same limiter covers the identity endpoints.
    const token = await request(app).post('/identity/v2/oauth2/token')
    assert.equal(token.statusCode, 429)
  })

  it('leaves the banking API unlimited', async () => {
    const accounts = await request(app).get('/za/pb/v1/accounts')
    assert.equal(accounts.statusCode, 200)
  })
})
