import { createHmac, randomUUID } from 'node:crypto'
import { PrismaClient, type Webhook } from '@prisma/client'
import { emitSocketEvent } from './app.js'
import { WEBHOOK_EVENTS } from './webhookEvents.js'

export { WEBHOOK_EVENTS }

const prisma = new PrismaClient()

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number] | 'webhook.test'

const DELIVERY_TIMEOUT_MS = 5000

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

// POST one event to one webhook and record the attempt.
export async function deliver(webhook: Webhook, event: WebhookEvent, data: unknown) {
  const deliveryId = randomUUID()
  const body = JSON.stringify({ id: deliveryId, event, createdAt: new Date().toISOString(), data })
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'programmable-banking-sandbox-webhooks',
    'X-Sandbox-Event': event,
    'X-Sandbox-Delivery': deliveryId,
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
    await Promise.all(webhooks.filter(w => subscribedTo(w, event)).map(w => deliver(w, event, data)))
  })().catch(err => console.log('Webhook delivery error:', err))
  inFlight.add(work)
  void work.finally(() => inFlight.delete(work))
}

// Resolves once every delivery started so far has been recorded.
export async function settleWebhookDeliveries(): Promise<void> {
  while (inFlight.size > 0) {
    await Promise.all([...inFlight])
  }
}
