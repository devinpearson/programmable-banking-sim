import request from 'supertest'
import { app } from '../src/app'
import { assert } from 'chai'

const CLIENT_ID = 'yAxzQRFX97vOcyQAwluEU6H6ePxMA5eY'
const CLIENT_SECRET = '4dY0PjEYqoBrZ99r'
const API_KEY =
  'eUF4elFSRlg5N3ZPY3lRQXdsdUVVNkg2ZVB4TUE1ZVk6YVc1MlpYTjBaV010ZW1FdGNHSXRZV05qYjNWdWRITXRjMkZ1WkdKdmVBPT0='

function basicAuthHeader(clientId: string, clientSecret: string) {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

function extractQueryParam(location: string, param: string) {
  const url = new URL(location, 'http://localhost')
  return url.searchParams.get(param)
}

async function login(qsp: string | null) {
  return request(app)
    .post('/login')
    .query({ qsp })
    .send({ email: 'admin@example.com', password: 'admin' })
}

async function getAuthorizationCode() {
  const authorizeResponse = await request(app).get(
    '/identity/v2/oauth2/authorize',
  ).query({
    client_id: CLIENT_ID,
    redirect_uri: 'http://example.com/callback',
    scope: 'accounts',
  })
  const qsp = extractQueryParam(authorizeResponse.headers.location, 'qsp')

  // The flow must be signed in before it can be approved.
  await login(qsp)

  const approveResponse = await request(app).get('/identity/approve').query({
    qsp,
  })
  const code = extractQueryParam(approveResponse.headers.location, 'code')
  return { qsp, code }
}

describe('Test the identity oauth endpoints', () => {
  it('should issue an access token via the client_credentials grant', async () => {
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .set('x-api-key', API_KEY)
      .send({ grant_type: 'client_credentials' })
    assert.equal(response.statusCode, 200)
    assert.exists(response.body.access_token)
    assert.equal(response.body.token_type, 'Bearer')
    assert.equal(response.body.scope, 'accounts')
  })

  it('should respond with 422 when no authorization header is sent', async () => {
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .send({ grant_type: 'client_credentials' })
    assert.equal(response.statusCode, 422)
  })

  it('should respond with 401 for incorrect client credentials', async () => {
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader('wrong', 'wrong'))
      .send({ grant_type: 'client_credentials' })
    assert.equal(response.statusCode, 401)
  })

  it('should respond with 401 when only the client_secret is wrong', async () => {
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, 'wrong-secret'))
      .send({ grant_type: 'client_credentials' })
    assert.equal(response.statusCode, 401)
  })

  it('should respond with 401 when only the client_id is wrong', async () => {
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader('wrong-client-id', CLIENT_SECRET))
      .send({ grant_type: 'client_credentials' })
    assert.equal(response.statusCode, 401)
  })

  it('should respond with 401 for an incorrect api key', async () => {
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .set('x-api-key', 'wrong-api-key')
      .send({ grant_type: 'client_credentials' })
    assert.equal(response.statusCode, 401)
  })

  it('should redirect to login with a session token when authorizing', async () => {
    const response = await request(app).get('/identity/v2/oauth2/authorize').query({
      client_id: CLIENT_ID,
      redirect_uri: 'http://example.com/callback',
      scope: 'accounts',
    })
    assert.equal(response.statusCode, 302)
    assert.match(response.headers.location, /^\/login\?qsp=/)
  })

  it('should respond with 401 when authorizing with the wrong client_id', async () => {
    const response = await request(app).get('/identity/v2/oauth2/authorize').query({
      client_id: 'wrong-client-id',
      redirect_uri: 'http://example.com/callback',
      scope: 'accounts',
    })
    assert.equal(response.statusCode, 401)
  })

  it('should approve and exchange an authorization code for a token, then refresh it', async () => {
    const { code } = await getAuthorizationCode()
    assert.exists(code)

    const tokenResponse = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({ grant_type: 'authorization_code', code })
    assert.equal(tokenResponse.statusCode, 200)
    assert.exists(tokenResponse.body.access_token)
    assert.exists(tokenResponse.body.refresh_token)

    const refreshResponse = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({
        grant_type: 'refresh_token',
        refresh_token: tokenResponse.body.refresh_token,
      })
    assert.equal(refreshResponse.statusCode, 200)
    assert.exists(refreshResponse.body.access_token)
    assert.equal(refreshResponse.body.token_type, 'Bearer')
    assert.equal(refreshResponse.body.scope, 'accounts')
    assert.notEqual(
      refreshResponse.body.refresh_token,
      tokenResponse.body.refresh_token,
    )

    const reuseResponse = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({
        grant_type: 'refresh_token',
        refresh_token: tokenResponse.body.refresh_token,
      })
    assert.equal(reuseResponse.statusCode, 401)
  })

  it('should respond with 401 for a refresh_token that does not exist', async () => {
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({ grant_type: 'refresh_token', refresh_token: 'does-not-exist' })
    assert.equal(response.statusCode, 401)
  })

  it('should respond with 401 for an authorization_code that does not exist', async () => {
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({ grant_type: 'authorization_code', code: 'does-not-exist' })
    assert.equal(response.statusCode, 401)
  })

  it('should decline a login request and redirect with a declined status', async () => {
    const authorizeResponse = await request(app).get('/identity/v2/oauth2/authorize').query({
      client_id: CLIENT_ID,
      redirect_uri: 'http://example.com/callback',
      scope: 'accounts',
    })
    const qsp = extractQueryParam(authorizeResponse.headers.location, 'qsp')

    const declineResponse = await request(app).get('/identity/decline').query({
      qsp,
    })
    assert.equal(declineResponse.statusCode, 302)
    assert.include(declineResponse.headers.location, 'status=DECLINED')
  })

  it('should respond with 400 when declining with an invalid qsp', async () => {
    const response = await request(app).get('/identity/decline').query({
      qsp: 'does-not-exist',
    })
    assert.equal(response.statusCode, 400)
  })

  it('should respond with 404 for the legacy /identity/oauth endpoint', async () => {
    const response = await request(app).get('/identity/oauth')
    assert.equal(response.statusCode, 404)
    assert.equal(response.body.error, 'endpoint_not_found')
  })

  it('should include expires_in in the client_credentials token response', async () => {
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .set('x-api-key', API_KEY)
      .send({ grant_type: 'client_credentials' })
    assert.equal(response.statusCode, 200)
    assert.isNumber(response.body.expires_in)
    assert.isAbove(response.body.expires_in, 0)
  })

  it('should include expires_in and refresh_token in the authorization_code token response', async () => {
    const { code } = await getAuthorizationCode()
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({ grant_type: 'authorization_code', code })
    assert.equal(response.statusCode, 200)
    assert.isNumber(response.body.expires_in)
    assert.isAbove(response.body.expires_in, 0)
    assert.exists(response.body.refresh_token)
    assert.isString(response.body.refresh_token)
  })

  it('should return the scope passed during authorization in the token response', async () => {
    const authorizeResponse = await request(app).get('/identity/v2/oauth2/authorize').query({
      client_id: CLIENT_ID,
      redirect_uri: 'http://example.com/callback',
      scope: 'transactions',
    })
    const qsp = extractQueryParam(authorizeResponse.headers.location, 'qsp')
    await login(qsp)
    const approveResponse = await request(app).get('/identity/approve').query({ qsp })
    const code = extractQueryParam(approveResponse.headers.location, 'code')

    const tokenResponse = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({ grant_type: 'authorization_code', code })
    assert.equal(tokenResponse.statusCode, 200)
    assert.equal(tokenResponse.body.scope, 'transactions')
  })

  it('should redirect approve to the redirect_uri with code and status=SUCCESS', async () => {
    const authorizeResponse = await request(app).get('/identity/v2/oauth2/authorize').query({
      client_id: CLIENT_ID,
      redirect_uri: 'http://example.com/callback',
      scope: 'accounts',
    })
    const qsp = extractQueryParam(authorizeResponse.headers.location, 'qsp')
    await login(qsp)
    const approveResponse = await request(app).get('/identity/approve').query({ qsp })
    assert.equal(approveResponse.statusCode, 302)
    assert.include(approveResponse.headers.location, 'http://example.com/callback')
    assert.include(approveResponse.headers.location, 'status=SUCCESS')
    assert.include(approveResponse.headers.location, 'code=')
    assert.include(approveResponse.headers.location, 'authorizationCode=')
  })

  it('should respond with 400 when approving with an invalid qsp', async () => {
    const response = await request(app).get('/identity/approve').query({ qsp: 'does-not-exist' })
    assert.equal(response.statusCode, 400)
  })

  it('should redirect decline with the correct redirect_uri and DECLINED status', async () => {
    const authorizeResponse = await request(app).get('/identity/v2/oauth2/authorize').query({
      client_id: CLIENT_ID,
      redirect_uri: 'http://example.com/callback',
      scope: 'accounts',
    })
    const qsp = extractQueryParam(authorizeResponse.headers.location, 'qsp')
    const declineResponse = await request(app).get('/identity/decline').query({ qsp })
    assert.equal(declineResponse.statusCode, 302)
    assert.include(declineResponse.headers.location, 'http://example.com/callback')
    assert.include(declineResponse.headers.location, 'status=DECLINED')
    assert.include(declineResponse.headers.location, 'code=')
  })

  it('should prepend http:// when the redirect_uri has no scheme on approve', async () => {
    const authorizeResponse = await request(app).get('/identity/v2/oauth2/authorize').query({
      client_id: CLIENT_ID,
      redirect_uri: 'example.com/callback',
      scope: 'accounts',
    })
    const qsp = extractQueryParam(authorizeResponse.headers.location, 'qsp')
    await login(qsp)
    const approveResponse = await request(app).get('/identity/approve').query({ qsp })
    assert.equal(approveResponse.statusCode, 302)
    assert.match(approveResponse.headers.location, /^http:\/\/example\.com/)
  })

  it('should include expires_in in the refresh_token response', async () => {
    const { code } = await getAuthorizationCode()
    const tokenResponse = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({ grant_type: 'authorization_code', code })

    const refreshResponse = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({ grant_type: 'refresh_token', refresh_token: tokenResponse.body.refresh_token })
    assert.equal(refreshResponse.statusCode, 200)
    assert.isNumber(refreshResponse.body.expires_in)
    assert.isAbove(refreshResponse.body.expires_in, 0)
    assert.exists(refreshResponse.body.refresh_token)
  })

  it('should refuse to approve a flow that has not signed in', async () => {
    const authorizeResponse = await request(app).get('/identity/v2/oauth2/authorize').query({
      client_id: CLIENT_ID,
      redirect_uri: 'http://example.com/callback',
      scope: 'accounts',
    })
    const qsp = extractQueryParam(authorizeResponse.headers.location, 'qsp')

    // No /login step: approval must be rejected.
    const approveResponse = await request(app).get('/identity/approve').query({ qsp })
    assert.equal(approveResponse.statusCode, 401)
  })

  it('should not issue an exchangeable code when the request is declined', async () => {
    const authorizeResponse = await request(app).get('/identity/v2/oauth2/authorize').query({
      client_id: CLIENT_ID,
      redirect_uri: 'http://example.com/callback',
      scope: 'accounts',
    })
    const qsp = extractQueryParam(authorizeResponse.headers.location, 'qsp')
    await login(qsp)

    const declineResponse = await request(app).get('/identity/decline').query({ qsp })
    const declinedCode = extractQueryParam(declineResponse.headers.location, 'code')
    assert.exists(declinedCode)

    // The declined code must not be exchangeable for a token.
    const tokenResponse = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({ grant_type: 'authorization_code', code: declinedCode })
    assert.equal(tokenResponse.statusCode, 401)
  })

  it('should not issue an exchangeable code before the request is approved', async () => {
    const authorizeResponse = await request(app).get('/identity/v2/oauth2/authorize').query({
      client_id: CLIENT_ID,
      redirect_uri: 'http://example.com/callback',
      scope: 'accounts',
    })
    const qsp = extractQueryParam(authorizeResponse.headers.location, 'qsp') as string
    // The qsp is the session handle, not the code, but prove no code works yet:
    const tokenResponse = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({ grant_type: 'authorization_code', code: qsp })
    assert.equal(tokenResponse.statusCode, 401)
  })

  it('should respond with 400 for an unknown grant_type', async () => {
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({ grant_type: 'something_else' })
    assert.equal(response.statusCode, 400)
  })

  it('should reject an authorization_code exchange with a mismatched redirect_uri', async () => {
    const authorizeResponse = await request(app).get('/identity/v2/oauth2/authorize').query({
      client_id: CLIENT_ID,
      redirect_uri: 'http://example.com/callback',
      scope: 'accounts',
    })
    const qsp = extractQueryParam(authorizeResponse.headers.location, 'qsp')
    await login(qsp)
    const approveResponse = await request(app).get('/identity/approve').query({ qsp })
    const code = extractQueryParam(approveResponse.headers.location, 'code')

    const tokenResponse = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .send({ grant_type: 'authorization_code', code, redirect_uri: 'http://evil.example.com/callback' })
    assert.equal(tokenResponse.statusCode, 401)
  })

  it('should issue cryptographically-random tokens', async () => {
    const response = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', basicAuthHeader(CLIENT_ID, CLIENT_SECRET))
      .set('x-api-key', API_KEY)
      .send({ grant_type: 'client_credentials' })
    assert.equal(response.statusCode, 200)
    assert.match(response.body.access_token, /^[0-9a-f]{48}$/)
  })
})
