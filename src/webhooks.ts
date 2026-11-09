import { createHmac, randomUUID } from 'node:crypto'
import { PrismaClient, type Webhook } from '@prisma/client'
import { emitSocketEvent } from './app.js'
import { WEBHOOK_EVENTS } from './webhookEvents.js'

export { WEBHOOK_EVENTS }

const prisma = new PrismaClient()

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number] | 'webhook.test'

const DELIVERY_TIMEOUT_MS = 5000

// After a failed delivery, retry after each of these delays (so up to four
// attempts in all). WEBHOOK_RETRY_DELAYS_MS overrides them, e.g. "1000,5000";
// "" turns retries off.
const DEFAULT_RETRY_DELAYS_MS = [5_000, 30_000, 120_000]

function retryDelays(): number[] {
  const configured = process.env.WEBHOOK_RETRY_DELAYS_MS
  if (configured === undefined) return DEFAULT_RETRY_DELAYS_MS
  return configured
    .split(',')
    .map(value => value.trim())
    // "" would otherwise become Number("") = 0, an instant retry.
    .filter(value => value !== '')
    .map(Number)
    .filter(ms => Number.isInteger(ms) && ms >= 0 && ms <= 3_600_000)
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Deliveries still in flight; tests wait on them with settleWebhookDeliveries.
const inFlight = new Set<Promise<unknown>>()

function subscribedTo(webhook: Pick<Webhook, 'events'>, event: WebhookEvent): boolean {
  if (event === 'webhook.test') return true
  const events = webhook.events.split(',').map(e => e.trim())
  return events.includes('*') || events.includes(event)
}

function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

// One event as delivered: every attempt sends the same body and id.
interface Envelope {
  eventId: string
  event: WebhookEvent
  body: string
}

function envelope(event: WebhookEvent, data: unknown): Envelope {
  const eventId = randomUUID()
  return { eventId, event, body: JSON.stringify({ id: eventId, event, createdAt: new Date().toISOString(), data }) }
}

// POST one event to one webhook once and record the attempt. Without an
// envelope it is a fresh event (e.g. a test send).
export async function deliver(webhook: Webhook, event: WebhookEvent, data: unknown, attempt = 1, existing?: Envelope) {
  const { eventId, body } = existing ?? envelope(event, data)
  const deliveryId = randomUUID()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'programmable-banking-sandbox-webhooks',
    'X-Sandbox-Event': event,
    // The same for every attempt at this event, so receivers can de-duplicate.
    'X-Sandbox-Delivery': eventId,
    'X-Sandbox-Attempt': String(attempt),
  }
  if (webhook.secret) {
    headers['X-Sandbox-Signature'] = signPayload(webhook.secret, body)
  }

  const started = Date.now()
  let responseStatus: number | null = null
  let error: string | null = null
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    })
    responseStatus = response.status
    // Drain the body so the connection is released.
    await response.arrayBuffer().catch(() => undefined)
    if (!response.ok) error = `Responded ${response.status}`
  } catch (err) {
    error =
      errorField(err, 'name') === 'TimeoutError'
        ? `No response within ${DELIVERY_TIMEOUT_MS / 1000}s`
        : describeFetchError(err)
  }

  const delivery = await prisma.webhookDelivery.create({
    data: {
      deliveryId,
      webhookId: webhook.webhookId,
      eventId,
      attempt,
      event,
      payload: body,
      status: error ? 'failed' : 'delivered',
      responseStatus,
      error,
      durationMs: Date.now() - started,
    },
  })
  emitSocketEvent('webhook-delivery', { deliveryId, webhookId: webhook.webhookId, event, status: delivery.status })
  return delivery
}

// Deliver, retrying failures after each configured delay. Stops early if
// the webhook is deleted or paused in the meantime.
async function deliverWithRetries(webhook: Webhook, event: WebhookEvent, data: unknown) {
  const env = envelope(event, data)
  const delays = retryDelays()
  let current = webhook
  for (let attempt = 1; ; attempt++) {
    const delivery = await deliver(current, event, data, attempt, env)
    if (delivery.status === 'delivered' || attempt > delays.length) return
    await sleep(delays[attempt - 1])
    const latest = await prisma.webhook.findUnique({ where: { webhookId: webhook.webhookId } })
    if (!latest?.active) return
    current = latest
  }
}

// Read a field off an error without instanceof, which fails for errors from
// another realm (e.g. fetch's errors under Jest).
function errorField(err: unknown, field: string): unknown {
  return err && typeof err === 'object' ? (err as Record<string, unknown>)[field] : undefined
}

// fetch wraps network errors ("fetch failed"); the cause says what happened.
function describeFetchError(err: unknown): string {
  const cause = errorField(err, 'cause')
  if (errorField(cause, 'code') === 'ECONNREFUSED') return 'Connection refused'
  const message = errorField(cause, 'message') || errorField(err, 'message')
  return typeof message === 'string' && message ? message : String(err)
}

// Send an event to every active webhook subscribed to it, in the
// background: the API call that caused it doesn't wait, and a failing
// receiver never fails that call.
export function publish(event: WebhookEvent, data: unknown): void {
  const work = (async () => {
    const webhooks = await prisma.webhook.findMany({ where: { active: true } })
    await Promise.all(webhooks.filter(w => subscribedTo(w, event)).map(w => deliverWithRetries(w, event, data)))
  })().catch(err => console.log('Webhook delivery error:', err))
  inFlight.add(work)
  void work.finally(() => inFlight.delete(work))
}

// Resolves once every delivery started so far, retries included, is done.
export async function settleWebhookDeliveries(): Promise<void> {
  while (inFlight.size > 0) {
    await Promise.all([...inFlight])
  }
}
