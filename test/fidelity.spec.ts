import request from 'supertest'
import { assert } from 'chai'
import dayjs from 'dayjs'
import { settings } from '../src/app'
import { app } from './app-server'

// Behaviour matched to the real Investec API: transfer and payment
// responses, Profiles, statement date filters, env var timestamps.
const ACCOUNTS = '/za/pb/v1/accounts'
const PROFILE = '10001234567890'
const MAIN = '4675778129910189600000003'

describe('Transfer responses', () => {
  const FROM = 'test-fidelity-from'
  const TO_A = 'test-fidelity-to-a'
  const TO_B = 'test-fidelity-to-b'

  beforeAll(async () => {
    for (const [accountId, accountNumber, accountName] of [
      [FROM, '91000000001', 'From'],
      [TO_A, '91000000002', 'Savings A'],
      [TO_B, '91000000003', 'Savings B'],
    ]) {
      await request(app).delete(`${ACCOUNTS}/${accountId}`)
      await request(app).post(ACCOUNTS).send({ accountId, accountNumber, accountName })
    }
    await request(app).post(`${ACCOUNTS}/${FROM}/topup`).send({ amount: 100 })
  })

  afterAll(async () => {
    for (const accountId of [FROM, TO_A, TO_B]) await request(app).delete(`${ACCOUNTS}/${accountId}`)
  })

  it('returns one TransferResponses entry per transfer, with unique references', async () => {
    const response = await request(app)
      .post(`${ACCOUNTS}/${FROM}/transfermultiple`)
      .send({
        transferList: [
          { beneficiaryAccountId: TO_A, amount: '10.00', myReference: 'a', theirReference: 'a' },
          { beneficiaryAccountId: TO_B, amount: '20.00', myReference: 'b', theirReference: 'b' },
        ],
      })
    assert.equal(response.statusCode, 200)
    const { TransferResponses, ErrorMessage } = response.body.data
    assert.isNull(ErrorMessage)
    assert.deepEqual(
      TransferResponses.map((r: { BeneficiaryName: string; BeneficiaryAccountId: string }) => [r.BeneficiaryName, r.BeneficiaryAccountId]),
      [
        ['Savings A', TO_A],
        ['Savings B', TO_B],
      ],
    )
    assert.notEqual(TransferResponses[0].PaymentReferenceNumber, TransferResponses[1].PaymentReferenceNumber)
    assert.equal(TransferResponses[0].PaymentDate, dayjs().format('DD/MM/YYYY'))
  })
})

describe('Profiles', () => {
  it('lists profiles, the first as the default', async () => {
    const response = await request(app).get('/za/pb/v1/profiles')
    assert.equal(response.statusCode, 200)
    assert.deepInclude(response.body.data, { profileId: PROFILE, profileName: 'Joe Soap', default: true })
  })

  it("lists a profile's accounts in the accounts shape", async () => {
    const response = await request(app).get(`/za/pb/v1/profiles/${PROFILE}/accounts`)
    assert.equal(response.statusCode, 200)
    const accounts = response.body.data.accounts
    assert.isAtLeast(accounts.length, 5)
    assert.isTrue(accounts.every((a: { profileId: string }) => a.profileId === PROFILE))
    assert.notProperty(accounts[0], 'overdraftLimit')
  })

  it('404s for an unknown profile', async () => {
    assert.equal((await request(app).get('/za/pb/v1/profiles/nope/accounts')).statusCode, 404)
  })

  describe('with auth on', () => {
    const CLIENT_ID = 'yAxzQRFX97vOcyQAwluEU6H6ePxMA5eY'
    const BASIC = `Basic ${Buffer.from(`${CLIENT_ID}:4dY0PjEYqoBrZ99r`).toString('base64')}`

    beforeAll(() => {
      settings.auth = true
    })
    afterAll(() => {
      settings.auth = false
    })

    async function consentToken(scope: string, accountNumbers: string[]) {
      const authorize = await request(app)
        .get('/identity/v2/oauth2/authorize')
        .query({ client_id: CLIENT_ID, redirect_uri: 'http://example.com/cb', scope })
      const qsp = new URL(authorize.headers.location).searchParams.get('qsp') as string
      await request(app).post('/login').query({ qsp }).send({ email: 'admin@example.com', password: 'admin' })
      const approve = await request(app)
        .get('/identity/approve')
        .query({ qsp, selectedAccounts: JSON.stringify(accountNumbers) })
      const code = new URL(approve.headers.location).searchParams.get('code')
      const token = await request(app)
        .post('/identity/v2/oauth2/token')
        .set('Authorization', BASIC)
        .send({ grant_type: 'authorization_code', code })
      return token.body.access_token as string
    }

    it('shows a 3-legged token only its consented accounts and needs the accounts scope', async () => {
      const token = await consentToken('accounts', ['10012420003'])
      const accounts = await request(app)
        .get(`/za/pb/v1/profiles/${PROFILE}/accounts`)
        .set('Authorization', `Bearer ${token}`)
      assert.deepEqual(
        accounts.body.data.accounts.map((a: { accountId: string }) => a.accountId),
        [MAIN],
      )

      const balancesOnly = await consentToken('balances', ['10012420003'])
      const refused = await request(app).get('/za/pb/v1/profiles').set('Authorization', `Bearer ${balancesOnly}`)
      assert.equal(refused.statusCode, 403)
    })
  })
})

describe('Statements', () => {
  const lastMonthEnd = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')

  it('lists the last three months by default, newest first', async () => {
    const response = await request(app).get(`${ACCOUNTS}/${MAIN}/documents`)
    const dates = response.body.data.documents.map((d: { documentDate: string }) => d.documentDate)
    assert.lengthOf(dates, 3)
    assert.equal(dates[0], lastMonthEnd)
    assert.deepEqual([...dates].sort().reverse(), dates)
  })

  it('filters by fromDate and toDate', async () => {
    const from = dayjs().subtract(12, 'month').startOf('month')
    const to = dayjs().subtract(7, 'month').endOf('month')
    const response = await request(app).get(
      `${ACCOUNTS}/${MAIN}/documents?fromDate=${from.format('YYYY-MM-DD')}&toDate=${to.format('YYYY-MM-DD')}`,
    )
    const dates = response.body.data.documents.map((d: { documentDate: string }) => d.documentDate)
    assert.lengthOf(dates, 6)
    assert.equal(dates[0], to.format('YYYY-MM-DD'))
    assert.equal(dates.at(-1), from.endOf('month').format('YYYY-MM-DD'))
  })

  it('validates the dates', async () => {
    const response = await request(app).get(`${ACCOUNTS}/${MAIN}/documents?fromDate=2024-06-01&toDate=2024-01-01`)
    assert.equal(response.statusCode, 400)
    assert.equal(response.body.errorMessage, 'toDate: must be on or after fromDate')
  })
})

describe('Card environment variables', () => {
  const CARD = 'test-fidelity-card'

  beforeAll(async () => {
    await request(app).delete(`/za/v1/cards/${CARD}`)
    await request(app).post('/za/v1/cards').send({ cardKey: CARD })
  })
  afterAll(async () => {
    await request(app).delete(`/za/v1/cards/${CARD}`)
  })

  it('reports when the variables were created and last changed', async () => {
    const before = Date.now()
    const saved = await request(app)
      .post(`/za/v1/cards/${CARD}/environmentvariables`)
      .send({ variables: { limit: 100 } })
    const { createdAt, updatedAt } = saved.body.data.result
    assert.isAtLeast(Date.parse(updatedAt), before - 1000)
    assert.isAtMost(Date.parse(createdAt), Date.parse(updatedAt))

    const read = await request(app).get(`/za/v1/cards/${CARD}/environmentvariables`)
    assert.equal(read.body.data.result.updatedAt, updatedAt)
    assert.deepEqual(read.body.data.result.variables, { limit: 100 })
  })
})
