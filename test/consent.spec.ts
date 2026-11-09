import request from 'supertest'
import { settings } from '../src/app'
import { app } from './app-server'
import { assert } from 'chai'

// With auth on: 3-legged tokens only reach the accounts the user consented to
// and only use the scopes they were granted. client_credentials tokens are
// unrestricted.
const CLIENT_ID = 'yAxzQRFX97vOcyQAwluEU6H6ePxMA5eY'
const CLIENT_SECRET = '4dY0PjEYqoBrZ99r'
const API_KEY =
  'eUF4elFSRlg5N3ZPY3lRQXdsdUVVNkg2ZVB4TUE1ZVk6YVc1MlpYTjBaV010ZW1FdGNHSXRZV05qYjNWdWRITXRjMkZ1WkdKdmVBPT0='
const BASIC = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
const MAIN = '4675778129910189600000003' // account number 10012420003, has card 700615
const SAVER = '4675778129910189600000004' // account number 10012420004

const param = (location: string, name: string) =>
  new URL(location, 'http://localhost').searchParams.get(name)

// Start a flow and sign in; returns the qsp handle.
async function signedInFlow(query: Record<string, string>) {
  const authorize = await request(app)
    .get('/identity/v2/oauth2/authorize')
    .query({ client_id: CLIENT_ID, redirect_uri: 'http://example.com/callback', ...query })
  const qsp = param(authorize.headers.location, 'qsp') as string
  await request(app)
    .post('/login')
    .query({ qsp })
    .send({ email: 'admin@example.com', password: 'admin' })
  return qsp
}

// Run the whole 3-legged flow; returns the token response body.
async function consentToken(scope: string | undefined, accountNumbers?: string[]) {
  const qsp = await signedInFlow(scope === undefined ? {} : { scope })
  const approve = await request(app)
    .get('/identity/approve')
    .query({
      qsp,
      ...(accountNumbers ? { selectedAccounts: JSON.stringify(accountNumbers) } : {}),
    })
  const code = param(approve.headers.location, 'code')
  const token = await request(app)
    .post('/identity/v2/oauth2/token')
    .set('Authorization', BASIC)
    .send({ grant_type: 'authorization_code', code })
  return token.body
}

const get = (path: string, token: string) =>
  request(app).get(path).set('Authorization', `Bearer ${token}`)

describe('OAuth consent and scope enforcement', () => {
  beforeAll(() => {
    settings.auth = true
  })
  afterAll(() => {
    settings.auth = false
  })

  it('rejects API calls without a token when auth is on', async () => {
    const response = await request(app).get('/za/pb/v1/accounts')
    assert.equal(response.statusCode, 401)
  })

  it('does not limit client_credentials tokens', async () => {
    const tokenResponse = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', BASIC)
      .set('x-api-key', API_KEY)
      .send({ grant_type: 'client_credentials' })
    const token = tokenResponse.body.access_token
    const accounts = await get('/za/pb/v1/accounts', token)
    assert.equal(accounts.statusCode, 200)
    assert.isAbove(accounts.body.data.accounts.length, 1)
    assert.equal((await get(`/za/pb/v1/accounts/${MAIN}/transactions`, token)).statusCode, 200)
    assert.equal((await get('/za/v1/cards', token)).statusCode, 200)
  })

  it('limits a 3-legged token to its consented accounts', async () => {
    const { access_token: token } = await consentToken('accounts balances', ['10012420003'])

    const accounts = await get('/za/pb/v1/accounts', token)
    assert.equal(accounts.statusCode, 200)
    assert.deepEqual(
      accounts.body.data.accounts.map((a: { accountId: string }) => a.accountId),
      [MAIN],
    )
    assert.equal((await get(`/za/pb/v1/accounts/${MAIN}/balance`, token)).statusCode, 200)

    const other = await get(`/za/pb/v1/accounts/${SAVER}/balance`, token)
    assert.equal(other.statusCode, 403)
    assert.equal(other.body.errorMessage, 'Account not consented for this token')
  })

  it('limits a 3-legged token to its granted scopes', async () => {
    const { access_token: token, scope } = await consentToken('accounts balances')
    assert.equal(scope, 'accounts balances')

    const transactions = await get(`/za/pb/v1/accounts/${MAIN}/transactions`, token)
    assert.equal(transactions.statusCode, 403)
    assert.equal(transactions.body.errorMessage, 'Token is missing scope: transactions')

    const cards = await get('/za/v1/cards', token)
    assert.equal(cards.statusCode, 403)
    assert.equal(cards.body.errorMessage, 'Token is missing scope: cards')
  })

  it('grants every scope when none is requested', async () => {
    const { access_token: token, scope } = await consentToken(undefined)
    assert.equal(
      scope,
      'accounts balances transactions transfers beneficiarypayments statements cards',
    )
    assert.equal((await get(`/za/pb/v1/accounts/${MAIN}/transactions`, token)).statusCode, 200)
  })

  it('hides cards on accounts that were not consented', async () => {
    const { access_token: token } = await consentToken('cards', ['10012420004'])
    const cards = await get('/za/v1/cards', token)
    assert.equal(cards.statusCode, 200)
    assert.isFalse(
      cards.body.data.cards.some((c: { CardKey: string }) => c.CardKey === '700615'),
    )
    const code = await get('/za/v1/cards/700615/code', token)
    assert.equal(code.statusCode, 403)
  })

  it('refuses a transfer into an account that was not consented', async () => {
    const { access_token: token } = await consentToken('transfers', ['10012420003'])
    const response = await request(app)
      .post(`/za/pb/v1/accounts/${MAIN}/transfermultiple`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        transferList: [
          { beneficiaryAccountId: SAVER, amount: 1, myReference: 'out', theirReference: 'in' },
        ],
      })
    assert.equal(response.statusCode, 403)
  })

  it('keeps the scope and accounts when a token is refreshed', async () => {
    const first = await consentToken('accounts balances', ['10012420003'])
    const refreshed = await request(app)
      .post('/identity/v2/oauth2/token')
      .set('Authorization', BASIC)
      .send({ grant_type: 'refresh_token', refresh_token: first.refresh_token })
    assert.equal(refreshed.statusCode, 200)
    assert.equal(refreshed.body.scope, 'accounts balances')

    const token = refreshed.body.access_token
    assert.equal((await get(`/za/pb/v1/accounts/${MAIN}/balance`, token)).statusCode, 200)
    assert.equal((await get(`/za/pb/v1/accounts/${SAVER}/balance`, token)).statusCode, 403)
    assert.equal((await get(`/za/pb/v1/accounts/${MAIN}/transactions`, token)).statusCode, 403)
  })
})

describe('OAuth authorize and consent page', () => {
  it('requires a valid redirect_uri', async () => {
    const missing = await request(app)
      .get('/identity/v2/oauth2/authorize')
      .query({ client_id: CLIENT_ID, scope: 'accounts' })
    assert.equal(missing.statusCode, 400)
    assert.equal(missing.body.errorMessage, 'redirect_uri must be a valid URL')
  })

  it('rejects an unknown scope', async () => {
    const response = await request(app)
      .get('/identity/v2/oauth2/authorize')
      .query({ client_id: CLIENT_ID, redirect_uri: 'http://example.com/cb', scope: 'accounts everything' })
    assert.equal(response.statusCode, 400)
    assert.match(response.body.errorMessage, /^Unknown scope/)
  })

  it('echoes state back on approve and decline', async () => {
    const approveQsp = await signedInFlow({ scope: 'accounts', state: 'xyz 123' })
    const approve = await request(app).get('/identity/approve').query({ qsp: approveQsp })
    assert.equal(param(approve.headers.location, 'state'), 'xyz 123')
    assert.equal(param(approve.headers.location, 'status'), 'SUCCESS')

    const declineQsp = await signedInFlow({ scope: 'accounts', state: 'abc' })
    const decline = await request(app).get('/identity/decline').query({ qsp: declineQsp })
    assert.equal(param(decline.headers.location, 'state'), 'abc')
    assert.equal(param(decline.headers.location, 'status'), 'DECLINED')
  })

  it('rejects malformed selectedAccounts', async () => {
    const qsp = await signedInFlow({ scope: 'accounts' })
    const response = await request(app)
      .get('/identity/approve')
      .query({ qsp, selectedAccounts: 'not-json' })
    assert.equal(response.statusCode, 400)
  })

  it('serves consent details only for a signed-in flow', async () => {
    assert.equal((await request(app).get('/identity/consent').query({ qsp: 'nope' })).statusCode, 400)

    const authorize = await request(app)
      .get('/identity/v2/oauth2/authorize')
      .query({ client_id: CLIENT_ID, redirect_uri: 'http://example.com/cb', scope: 'accounts' })
    const notSignedIn = param(authorize.headers.location, 'qsp') as string
    assert.equal(
      (await request(app).get('/identity/consent').query({ qsp: notSignedIn })).statusCode,
      401,
    )

    const qsp = await signedInFlow({ scope: 'accounts transactions' })
    const consent = await request(app).get('/identity/consent').query({ qsp })
    assert.equal(consent.statusCode, 200)
    assert.deepEqual(
      consent.body.data.scopes.map((s: { scope: string }) => s.scope),
      ['accounts', 'transactions'],
    )
    assert.exists(consent.body.data.scopes[0].description)
    assert.isAbove(consent.body.data.accounts.length, 0)
    assert.exists(consent.body.data.accounts[0].accountNumber)
  })
})
