import express from 'express'
import { formatResponse } from '../app.js'
import { getClock, setOffsetDays } from '../clock.js'
import { validateRequest, validatedBody } from '../middleware/validation.js'
import { runDueUpTo } from '../schedules.js'
import { advanceClockBody } from '../schema/requestSchemas.js'

const router = express.Router()

// Sandbox control for the clock (src/clock.ts).

router.get('/', (req, res) => {
  return formatResponse(getClock(), req, res)
})

// Move the clock forward; everything that falls due on the way runs, in
// date order.
router.post('/advance', validateRequest({ body: advanceClockBody }), async (req, res) => {
  const { days } = validatedBody(res, advanceClockBody)
  const clock = await setOffsetDays(getClock().offsetDays + days)
  const ran = await runDueUpTo(clock.today)
  return formatResponse({ ...clock, ...ran }, req, res)
})

// Back to the real date. What already ran stays.
router.post('/reset', async (req, res) => {
  return formatResponse(await setOffsetDays(0), req, res)
})

export default router
