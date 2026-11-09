import request from 'supertest'
import { assert } from 'chai'
import dayjs from 'dayjs'
import { app } from './app-server'
import { firstRunOnOrAfter } from '../src/schedules'

// The sandbox clock and recurring transactions (src/clock.ts,
// src/schedules.ts). The clock is saved in the shared test database, so
// every test puts it back.
const ACCOUNTS = '/za/pb/v1/accounts'
const ACCOUNT_ID = 'test-time-account-001'

interface Tx {
  transactionType: string
  description: string
  postingDate: string
  amount: string
  type: string
  status: string
}

async function history(accountId = ACCOUNT_ID): Promise<Tx[]> {
  const response = await request(app).get(`${ACCOUNTS}/${accountId}/transactions?fromDate=2000-01-01&toDate=2100-01-01&includePending=true`)
  return response.body.data.transactions
}

async function schedule(body: Record<string, unknown>) {
  const response = await request(app).post('/schedules').send({ accountId: ACCOUNT_ID, ...body })
  assert.equal(response.statusCode, 200, JSON.stringify(response.body))
  return response.body.data
}

const advance = (days: number) => request(app).post('/clock/advance').send({ days })
const today = async () => (await request(app).get('/clock')).body.data.today as string

beforeEach(async () => {
  await request(app).post('/clock/reset')
  await request(app).delete(`${ACCOUNTS}/${ACCOUNT_ID}`)
  await request(app).post(ACCOUNTS).send({ accountId: ACCOUNT_ID, accountNumber: '93000000001', overdraftLimit: 100000 })
})

afterAll(async () => {
  await request(app).post('/clock/reset')
  await request(app).get('/restore')
})

describe('Sandbox clock', () => {
  it('starts at the real date', async () => {
    const { data } = (await request(app).get('/clock')).body
    assert.deepEqual(data, { today: dayjs().format('YYYY-MM-DD'), realToday: dayjs().format('YYYY-MM-DD'), offsetDays: 0 })
  })

  it('moves forward, and banking dates follow it', async () => {
    const response = await advance(10)
    const expected = dayjs().add(10, 'day').format('YYYY-MM-DD')
    assert.equal(response.body.data.today, expected)
    assert.equal(response.body.data.offsetDays, 10)

    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 5 })
    // The default transaction range ends on the sandbox date, so it shows.
    const listed = (await request(app).get(`${ACCOUNTS}/${ACCOUNT_ID}/transactions`)).body.data.transactions
    assert.equal(listed[0].postingDate, expected)
  })

  it('resets to the real date, keeping what already ran', async () => {
    await advance(5)
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 5 })
    const reset = await request(app).post('/clock/reset')
    assert.equal(reset.body.data.offsetDays, 0)
    assert.lengthOf(await history(), 1)
  })

  it('only moves forward, by 1 to 366 days', async () => {
    for (const days of [0, -1, 367, 1.5]) {
      assert.equal((await advance(days)).statusCode, 400, String(days))
    }
  })
})

describe('Schedule dates', () => {
  it('clamps day 31 to the end of shorter months', () => {
    assert.equal(firstRunOnOrAfter({ frequency: 'monthly', dayOfMonth: 31, dayOfWeek: null }, '2027-02-10'), '2027-02-28')
    assert.equal(firstRunOnOrAfter({ frequency: 'monthly', dayOfMonth: 15, dayOfWeek: null }, '2027-02-16'), '2027-03-15')
    assert.equal(firstRunOnOrAfter({ frequency: 'monthly', dayOfMonth: 15, dayOfWeek: null }, '2027-02-15'), '2027-02-15')
  })

  it('finds the next weekday', () => {
    // 2027-02-10 is a Wednesday (3).
    assert.equal(firstRunOnOrAfter({ frequency: 'weekly', dayOfMonth: null, dayOfWeek: 3 }, '2027-02-10'), '2027-02-10')
    assert.equal(firstRunOnOrAfter({ frequency: 'weekly', dayOfMonth: null, dayOfWeek: 1 }, '2027-02-10'), '2027-02-15')
  })
})

describe('Schedules', () => {
  it('posts a monthly amount on each run date as the clock passes it', async () => {
    const start = await today()
    await schedule({ description: 'Salary', kind: 'fixed', type: 'CREDIT', amount: 1000, frequency: 'monthly', dayOfMonth: 15 })
    const response = await advance(70)
    const end = response.body.data.today

    // Every 15th in [start, end].
    const expected: string[] = []
    for (let d = dayjs(start); !d.isAfter(end); d = d.add(1, 'day')) if (d.date() === 15) expected.push(d.format('YYYY-MM-DD'))
    assert.equal(response.body.data.posted, expected.length)
    const salaries = (await history()).filter(t => t.description === 'Salary')
    assert.sameMembers(salaries.map(t => t.postingDate), expected)
    assert.isTrue(salaries.every(t => t.type === 'CREDIT' && t.transactionType === 'Deposits' && t.amount === '1000'))
  })

  it('runs weekly debit orders', async () => {
    await schedule({ description: 'Coffee club', kind: 'fixed', type: 'DEBIT', amount: 50, frequency: 'weekly', dayOfWeek: dayjs().add(1, 'day').day() })
    await advance(14)
    const runs = (await history()).filter(t => t.description === 'Coffee club')
    assert.lengthOf(runs, 2)
    assert.isTrue(runs.every(t => t.type === 'DEBIT' && t.transactionType === 'DebitOrders'))
  })

  it('pays interest on a positive balance and charges it on an overdrawn one', async () => {
    const OTHER = 'test-time-account-002'
    await request(app).delete(`${ACCOUNTS}/${OTHER}`)
    await request(app).post(ACCOUNTS).send({ accountId: OTHER, accountNumber: '93000000002', overdraftLimit: 100000 })
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 1200 })
    await request(app).post(`${ACCOUNTS}/${OTHER}/transactions`).send({ type: 'DEBIT', transactionType: 'FasterPay', status: 'POSTED', amount: 2400 })
    const day = dayjs().add(1, 'day').date()
    await schedule({ description: 'Interest', kind: 'interest', annualRatePercent: 12, frequency: 'monthly', dayOfMonth: day })
    await request(app).post('/schedules').send({ accountId: OTHER, description: 'Interest', kind: 'interest', annualRatePercent: 12, frequency: 'monthly', dayOfMonth: day })
    await advance(1)

    // 12% a year is 1% a month.
    const earned = (await history()).find(t => t.transactionType === 'FeesAndInterest')
    assert.include(earned, { type: 'CREDIT', amount: '12', description: 'Interest (12% a year)' })
    const charged = (await history(OTHER)).find(t => t.transactionType === 'FeesAndInterest')
    assert.include(charged, { type: 'DEBIT', amount: '24' })
    await request(app).delete(`${ACCOUNTS}/${OTHER}`)
  })

  it('runs everything in date order, so interest sees that day’s balance', async () => {
    const salaryDay = dayjs().add(2, 'day')
    const interestDay = dayjs().add(3, 'day')
    // Created interest-first, but the salary falls due first.
    await schedule({ description: 'Interest', kind: 'interest', annualRatePercent: 12, frequency: 'monthly', dayOfMonth: interestDay.date(), startDate: interestDay.format('YYYY-MM-DD') })
    await schedule({ description: 'Salary', kind: 'fixed', type: 'CREDIT', amount: 3000, frequency: 'monthly', dayOfMonth: salaryDay.date(), startDate: salaryDay.format('YYYY-MM-DD') })
    await advance(3)
    const interest = (await history()).find(t => t.transactionType === 'FeesAndInterest')
    assert.equal(interest?.amount, '30')
  })

  it('skips paused schedules and stops when deleted', async () => {
    const paused = await schedule({ description: 'Paused', kind: 'fixed', type: 'CREDIT', amount: 1, frequency: 'weekly', dayOfWeek: dayjs().add(1, 'day').day() })
    await request(app).patch(`/schedules/${paused.scheduleId}`).send({ active: false })
    const deleted = await schedule({ description: 'Deleted', kind: 'fixed', type: 'CREDIT', amount: 1, frequency: 'weekly', dayOfWeek: dayjs().add(1, 'day').day() })
    assert.equal((await request(app).delete(`/schedules/${deleted.scheduleId}`)).statusCode, 200)
    await advance(8)
    assert.lengthOf(await history(), 0)
  })

  it('validates schedules', async () => {
    const noAmount = await request(app).post('/schedules').send({ accountId: ACCOUNT_ID, description: 'x', kind: 'fixed', type: 'DEBIT', frequency: 'monthly', dayOfMonth: 1 })
    assert.equal(noAmount.statusCode, 400)
    assert.equal(noAmount.body.errorMessage, 'amount: is required for a fixed amount')
    const noDay = await request(app).post('/schedules').send({ accountId: ACCOUNT_ID, description: 'x', kind: 'interest', annualRatePercent: 5, frequency: 'weekly' })
    assert.equal(noDay.body.errorMessage, 'dayOfWeek: is required for weekly')
    const noAccount = await request(app).post('/schedules').send({ accountId: 'nope', description: 'x', kind: 'interest', annualRatePercent: 5, frequency: 'monthly', dayOfMonth: 1 })
    assert.equal(noAccount.statusCode, 422)
    const interest = await schedule({ description: 'Interest', kind: 'interest', annualRatePercent: 5, frequency: 'monthly', dayOfMonth: 1 })
    const wrongField = await request(app).patch(`/schedules/${interest.scheduleId}`).send({ amount: 10 })
    assert.equal(wrongField.statusCode, 400)
  })
})

describe('Card holds settle by themselves', () => {
  it('posts a hold three days after the swipe', async () => {
    await request(app).post(`${ACCOUNTS}/${ACCOUNT_ID}/topup`).send({ amount: 500 })
    const card = (await request(app).post('/za/v1/cards').send({ accountId: ACCOUNT_ID })).body.data
    const swipe = await request(app)
      .post(`/za/v1/cards/${card.cardKey}/code/execute-live`)
      .send({ currencyCode: 'ZAR', centsAmount: 2500, merchantCode: '5411', merchantName: 'Settles Later', merchantCity: 'CT', countryCode: 'ZA' })
    const swipedOn = swipe.body.data.transaction.transactionDate

    assert.equal((await advance(2)).body.data.settled, 0)
    assert.equal((await history()).find(t => t.description === 'Settles Later')?.status, 'PENDING')

    assert.equal((await advance(1)).body.data.settled, 1)
    const settled = (await history()).find(t => t.description === 'Settles Later')
    assert.equal(settled?.status, 'POSTED')
    assert.equal(settled?.postingDate, dayjs(swipedOn).add(3, 'day').format('YYYY-MM-DD'))
  })
})

describe('Scenarios with recurring activity', () => {
  it('runs a month of the Hackathon scenario', async () => {
    const loaded = await request(app).post('/scenarios/hackathon')
    assert.equal(loaded.body.data.schedules, 5)
    const response = await advance(31)
    // Salary, two debit orders and two interest runs, each at least once.
    assert.isAtLeast(response.body.data.posted, 5)
    const cheque = await history('30000000000000000000021')
    for (const description of ['Salary', 'Gym membership', 'Car insurance']) {
      assert.isTrue(cheque.some(t => t.description === description), description)
    }
  })
})
