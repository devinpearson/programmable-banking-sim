import express from 'express'
import { randomUUID } from 'node:crypto'
import { PrismaClient, type Schedule } from '@prisma/client'
import { formatErrorResponse, formatResponse } from '../app.js'
import { sandboxDate } from '../clock.js'
import { firstRunOnOrAfter } from '../schedules.js'
import { validateRequest, validatedBody } from '../middleware/validation.js'
import { createScheduleBody, scheduleIdParams, updateScheduleBody } from '../schema/requestSchemas.js'

const router = express.Router()
const prisma = new PrismaClient()

// Sandbox control: recurring transactions (src/schedules.ts).

function scheduleResponse(schedule: Schedule) {
  return {
    ...schedule,
    amount: schedule.amount?.toNumber() ?? null,
    annualRatePercent: schedule.annualRatePercent?.toNumber() ?? null,
    createdAt: schedule.createdAt.toISOString(),
  }
}

const DEFAULT_TYPES = { CREDIT: 'Deposits', DEBIT: 'DebitOrders', interest: 'FeesAndInterest' } as const

router.get('/', async (req, res) => {
  const schedules = await prisma.schedule.findMany({ orderBy: [{ nextRunDate: 'asc' }, { createdAt: 'asc' }] })
  return formatResponse({ schedules: schedules.map(scheduleResponse) }, req, res)
})

router.post('/', validateRequest({ body: createScheduleBody }), async (req, res) => {
  const body = validatedBody(res, createScheduleBody)
  const account = await prisma.account.findUnique({ where: { accountId: body.accountId } })
  if (!account) {
    return formatErrorResponse(req, res, 422, `No account with id ${body.accountId}`)
  }
  const interest = body.kind === 'interest'
  const type = interest ? 'CREDIT' : (body.type as 'DEBIT' | 'CREDIT')
  const schedule = await prisma.schedule.create({
    data: {
      scheduleId: randomUUID(),
      accountId: body.accountId,
      description: body.description,
      kind: body.kind,
      type,
      transactionType: body.transactionType ?? (interest ? DEFAULT_TYPES.interest : DEFAULT_TYPES[type]),
      amount: interest ? null : body.amount,
      annualRatePercent: interest ? body.annualRatePercent : null,
      frequency: body.frequency,
      dayOfMonth: body.frequency === 'monthly' ? body.dayOfMonth : null,
      dayOfWeek: body.frequency === 'weekly' ? body.dayOfWeek : null,
      nextRunDate: firstRunOnOrAfter(
        { frequency: body.frequency, dayOfMonth: body.dayOfMonth ?? null, dayOfWeek: body.dayOfWeek ?? null },
        body.startDate ?? sandboxDate(),
      ),
    },
  })
  return formatResponse(scheduleResponse(schedule), req, res)
})

router.patch(
  '/:scheduleId',
  validateRequest({ params: scheduleIdParams, body: updateScheduleBody }),
  async (req, res) => {
    const existing = await prisma.schedule.findUnique({ where: { scheduleId: req.params.scheduleId } })
    if (!existing) {
      return formatErrorResponse(req, res, 404)
    }
    const body = validatedBody(res, updateScheduleBody)
    if (existing.kind === 'interest' && body.amount !== undefined) {
      return formatErrorResponse(req, res, 400, 'amount: interest schedules use annualRatePercent')
    }
    if (existing.kind === 'fixed' && body.annualRatePercent !== undefined) {
      return formatErrorResponse(req, res, 400, 'annualRatePercent: fixed schedules use amount')
    }
    const schedule = await prisma.schedule.update({ where: { scheduleId: existing.scheduleId }, data: body })
    return formatResponse(scheduleResponse(schedule), req, res)
  },
)

router.delete('/:scheduleId', validateRequest({ params: scheduleIdParams }), async (req, res) => {
  const deleted = await prisma.schedule.deleteMany({ where: { scheduleId: req.params.scheduleId } })
  if (deleted.count === 0) {
    return formatErrorResponse(req, res, 404)
  }
  return res.status(200).json({})
})

export default router
