import express from 'express'
import { PrismaClient } from '@prisma/client'
import { formatErrorResponse, formatResponse } from '../app.js'
import { HOME_CURRENCY } from '../fx.js'
import { validateRequest, validatedBody } from '../middleware/validation.js'
import { currencyCodeParams, exchangeRateBody } from '../schema/requestSchemas.js'

const router = express.Router()
const prisma = new PrismaClient()

// Sandbox-only: the rates used to convert foreign card swipes to rand.
// Investec's API has no equivalent.

function toResponse(rate: { currencyCode: string; zarPerUnit: { toNumber(): number }; updatedAt: Date }) {
  return {
    currencyCode: rate.currencyCode,
    zarPerUnit: rate.zarPerUnit.toNumber(),
    updatedAt: rate.updatedAt.toISOString(),
  }
}

router.get('/', async (req, res) => {
  const rates = await prisma.exchangeRate.findMany({ orderBy: { currencyCode: 'asc' } })
  return formatResponse({ rates: rates.map(toResponse) }, req, res)
})

// Add a currency or change its rate.
router.put(
  '/:currencyCode',
  validateRequest({ params: currencyCodeParams, body: exchangeRateBody }),
  async (req, res) => {
    const currencyCode = currencyCodeParams.parse(req.params).currencyCode
    if (currencyCode === HOME_CURRENCY) {
      return formatErrorResponse(req, res, 400, 'ZAR is the home currency; its rate is always 1')
    }
    const { zarPerUnit } = validatedBody(res, exchangeRateBody)
    const rate = await prisma.exchangeRate.upsert({
      where: { currencyCode },
      update: { zarPerUnit },
      create: { currencyCode, zarPerUnit },
    })
    return formatResponse(toResponse(rate), req, res)
  },
)

router.delete('/:currencyCode', validateRequest({ params: currencyCodeParams }), async (req, res) => {
  const currencyCode = currencyCodeParams.parse(req.params).currencyCode
  const deleted = await prisma.exchangeRate.deleteMany({ where: { currencyCode } })
  if (deleted.count === 0) {
    return formatErrorResponse(req, res, 404)
  }
  return res.status(200).json({})
})

export default router
