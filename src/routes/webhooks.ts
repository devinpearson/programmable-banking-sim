import express from 'express'
import { randomUUID } from 'node:crypto'
import { PrismaClient, type Webhook, type WebhookDelivery } from '@prisma/client'
import { formatErrorResponse, formatResponse } from '../app.js'
import { WEBHOOK_EVENTS, deliver } from '../webhooks.js'
import { validateRequest, validatedBody, validatedQuery } from '../middleware/validation.js'
import {
  createWebhookBody,
  deliveriesQuery,
  updateWebhookBody,
  webhookIdParams,
} from '../schema/requestSchemas.js'

const router = express.Router()
const prisma = new PrismaClient()

// Sandbox-only: register URLs to receive events (src/webhooks.ts). Outside
// /za, so it needs no token.

// Secrets are never returned; hasSecret says whether deliveries are signed.
function toResponse(webhook: Webhook) {
  return {
    webhookId: webhook.webhookId,
    url: webhook.url,
    events: webhook.events.split(','),
    hasSecret: webhook.secret !== null,
    active: webhook.active,
    createdAt: webhook.createdAt.toISOString(),
  }
}

function deliveryResponse(delivery: WebhookDelivery) {
  return {
    deliveryId: delivery.deliveryId,
    webhookId: delivery.webhookId,
    eventId: delivery.eventId,
    attempt: delivery.attempt,
    event: delivery.event,
    status: delivery.status,
    responseStatus: delivery.responseStatus,
    error: delivery.error,
    durationMs: delivery.durationMs,
    createdAt: delivery.createdAt.toISOString(),
    payload: JSON.parse(delivery.payload),
  }
}

router.get('/', async (req, res) => {
  const webhooks = await prisma.webhook.findMany({ orderBy: { createdAt: 'asc' } })
  return formatResponse({ webhooks: webhooks.map(toResponse) }, req, res)
})

router.get('/events', (req, res) => {
  return formatResponse({ events: WEBHOOK_EVENTS }, req, res)
})

router.post('/', validateRequest({ body: createWebhookBody }), async (req, res) => {
  const { url, events, secret } = validatedBody(res, createWebhookBody)
  const webhook = await prisma.webhook.create({
    data: {
      webhookId: randomUUID(),
      url,
      events: (events ?? ['*']).join(','),
      secret: secret ?? null,
    },
  })
  return formatResponse(toResponse(webhook), req, res)
})

router.patch(
  '/:webhookId',
  validateRequest({ params: webhookIdParams, body: updateWebhookBody }),
  async (req, res) => {
    const existing = await prisma.webhook.findUnique({ where: { webhookId: req.params.webhookId } })
    if (!existing) {
      return formatErrorResponse(req, res, 404)
    }
    const { url, events, active } = validatedBody(res, updateWebhookBody)
    const webhook = await prisma.webhook.update({
      where: { webhookId: existing.webhookId },
      data: { url, active, events: events?.join(',') },
    })
    return formatResponse(toResponse(webhook), req, res)
  },
)

router.delete('/:webhookId', validateRequest({ params: webhookIdParams }), async (req, res) => {
  const deleted = await prisma.webhook.deleteMany({ where: { webhookId: req.params.webhookId } })
  if (deleted.count === 0) {
    return formatErrorResponse(req, res, 404)
  }
  return res.status(200).json({})
})

// Send a webhook.test event now and return how the delivery went.
router.post('/:webhookId/test', validateRequest({ params: webhookIdParams }), async (req, res) => {
  const webhook = await prisma.webhook.findUnique({ where: { webhookId: req.params.webhookId } })
  if (!webhook) {
    return formatErrorResponse(req, res, 404)
  }
  const delivery = await deliver(webhook, 'webhook.test', {
    message: 'A test delivery from the programmable banking sandbox.',
  })
  return formatResponse(deliveryResponse(delivery), req, res)
})

// Recent delivery attempts, newest first.
router.get(
  '/:webhookId/deliveries',
  validateRequest({ params: webhookIdParams, query: deliveriesQuery }),
  async (req, res) => {
    const webhook = await prisma.webhook.findUnique({ where: { webhookId: req.params.webhookId } })
    if (!webhook) {
      return formatErrorResponse(req, res, 404)
    }
    const { limit } = validatedQuery(res, deliveriesQuery)
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: webhook.webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return formatResponse({ deliveries: deliveries.map(deliveryResponse) }, req, res)
  },
)

export default router
