import request from 'supertest'
import { assert } from 'chai'
import { app } from './app-server'

// Fault injection (src/faults.ts): per-request headers and random faults
// from the saved config.
const ACCOUNTS = '/za/pb/v1/accounts'
const CARDS = '/za/v1/cards'
const TOKEN = '/identity/v2/oauth2/token'

// Timings use performance.now(), a monotonic clock: Date.now() follows the
// wall clock, which CI machines can step mid-test (a 300 ms latency once
// measured as 3 ms).

// How a request that never gets a response fails.
async function connectionError(promise: PromiseLike<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    const err = error as { code?: string; message?: string }
    return err.code ?? err.message ?? String(error)
  }
  return 'responded'
}

afterEach(async () => {
  await request(app).delete('/faults')
})

describe('Fault injection headers', () => {
  for (const status of [429, 500, 502, 503, 504]) {
    it(`answers X-Sandbox-Fault: ${status} with that error`, async () => {
      const response = await request(app).get(ACCOUNTS).set('X-Sandbox-Fault', String(status))
      assert.equal(response.statusCode, status)
      assert.match(response.body.errorMessage, new RegExp(`^Simulated fault: ${status} `))
      assert.equal(response.headers['x-sandbox-fault-injected'], String(status))
    })
  }

  it('adds Retry-After to a simulated 429', async () => {
    const response = await request(app).get(ACCOUNTS).set('X-Sandbox-Fault', '429')
    assert.equal(response.headers['retry-after'], '1')
  })

  it('drops the connection for reset', async () => {
    const outcome = await connectionError(request(app).get(ACCOUNTS).set('X-Sandbox-Fault', 'reset'))
    assert.oneOf(outcome, ['ECONNRESET', 'socket hang up'])
  })

  it('holds the request, then drops it, for timeout:<ms>', async () => {
    const started = performance.now()
    const outcome = await connectionError(request(app).get(ACCOUNTS).set('X-Sandbox-Fault', 'timeout:300'))
    assert.oneOf(outcome, ['ECONNRESET', 'socket hang up'])
    assert.isAtLeast(performance.now() - started, 290)
  })

  it('holds at most 25 requests at once; more are dropped straight away', async () => {
    const started = performance.now()
    const finished: number[] = []
    await Promise.all(
      Array.from({ length: 26 }, () =>
        connectionError(request(app).get(ACCOUNTS).set('X-Sandbox-Fault', 'timeout:1500')).then(() =>
          finished.push(performance.now() - started),
        ),
      ),
    )
    finished.sort((a, b) => a - b)
    assert.isBelow(finished[0], 1000, 'one request is dropped at once')
    assert.isAtLeast(finished[1], 1400, 'the other 25 are held')
  })

  it('delays the response by X-Sandbox-Latency', async () => {
    const started = performance.now()
    const response = await request(app).get(ACCOUNTS).set('X-Sandbox-Latency', '300')
    assert.equal(response.statusCode, 200)
    assert.isAtLeast(performance.now() - started, 290)
  })

  it('applies to the token endpoint too', async () => {
    const response = await request(app).post(TOKEN).set('X-Sandbox-Fault', '503')
    assert.equal(response.statusCode, 503)
  })

  it('rejects headers it does not understand', async () => {
    const fault = await request(app).get(ACCOUNTS).set('X-Sandbox-Fault', '418')
    assert.equal(fault.statusCode, 400)
    assert.match(fault.body.errorMessage, /^X-Sandbox-Fault must be one of 429, 500, 502, 503, 504/)
    const latency = await request(app).get(ACCOUNTS).set('X-Sandbox-Latency', 'slow')
    assert.equal(latency.statusCode, 400)
  })

  it("never touches the sandbox's own controls", async () => {
    const response = await request(app).get('/faults').set('X-Sandbox-Fault', '503')
    assert.equal(response.statusCode, 200)
  })
})

describe('Fault injection config', () => {
  it('starts with every fault off', async () => {
    const response = await request(app).get('/faults')
    assert.deepEqual(response.body.data, {
      errorRate: 0,
      errorStatus: 503,
      timeoutRate: 0,
      latencyMs: 0,
      pathPrefix: '',
      active: false,
    })
  })

  it('fails every matching request at a 100% error rate', async () => {
    const saved = await request(app).put('/faults').send({ errorRate: 100, errorStatus: 500 })
    assert.isTrue(saved.body.data.active)
    for (let i = 0; i < 3; i++) {
      assert.equal((await request(app).get(ACCOUNTS)).statusCode, 500)
    }
  })

  it('limits faults to a path prefix', async () => {
    await request(app).put('/faults').send({ errorRate: 100, pathPrefix: CARDS })
    assert.equal((await request(app).get(CARDS)).statusCode, 503)
    assert.equal((await request(app).get(ACCOUNTS)).statusCode, 200)
  })

  it('fails roughly the configured share of requests', async () => {
    await request(app).put('/faults').send({ errorRate: 50 })
    let failed = 0
    for (let i = 0; i < 200; i++) {
      if ((await request(app).get(`${ACCOUNTS}/beneficiarycategories`)).statusCode === 503) failed++
    }
    // 50% of 200 ± a generous margin.
    assert.isAbove(failed, 60)
    assert.isBelow(failed, 140)
  })

  it('adds the configured latency', async () => {
    await request(app).put('/faults').send({ latencyMs: 250 })
    const started = performance.now()
    assert.equal((await request(app).get(ACCOUNTS)).statusCode, 200)
    assert.isAtLeast(performance.now() - started, 240)
  })

  it('leaves the dashboard alone, unless it asks for a fault', async () => {
    await request(app).put('/faults').send({ errorRate: 100 })
    const dashboard = await request(app).get(ACCOUNTS).set('X-Sandbox-Client', 'dashboard')
    assert.equal(dashboard.statusCode, 200)
    const explicit = await request(app).get(ACCOUNTS).set('X-Sandbox-Client', 'dashboard').set('X-Sandbox-Fault', '502')
    assert.equal(explicit.statusCode, 502)
  })

  it('is saved, and DELETE turns everything off', async () => {
    await request(app).put('/faults').send({ timeoutRate: 10, latencyMs: 100 })
    assert.include((await request(app).get('/faults')).body.data, { timeoutRate: 10, latencyMs: 100, active: true })
    const off = await request(app).delete('/faults')
    assert.isFalse(off.body.data.active)
    assert.equal((await request(app).get(ACCOUNTS)).statusCode, 200)
  })

  it('validates the config', async () => {
    const response = await request(app)
      .put('/faults')
      .send({ errorRate: 150, errorStatus: 418, latencyMs: -1, pathPrefix: 'za', retries: 3 })
    assert.equal(response.statusCode, 400)
    assert.sameMembers(
      response.body.details.map((d: { path: string }) => d.path),
      ['errorRate', 'errorStatus', 'latencyMs', 'pathPrefix', 'body'],
    )
  })
})
