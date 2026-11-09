import express from 'express'
import { formatResponse } from '../app.js'
import { NO_FAULTS, faultsActive, getFaultConfig, saveFaultConfig, type FaultConfig } from '../faults.js'
import { validateRequest, validatedBody } from '../middleware/validation.js'
import { faultConfigBody } from '../schema/requestSchemas.js'

const router = express.Router()

// Sandbox control for fault injection (src/faults.ts). Outside /za, so it
// is never itself faulted.

function toResponse(config: FaultConfig) {
  return { ...config, active: faultsActive(config) }
}

router.get('/', (req, res) => {
  return formatResponse(toResponse(getFaultConfig()), req, res)
})

router.put('/', validateRequest({ body: faultConfigBody }), async (req, res) => {
  const config = await saveFaultConfig(validatedBody(res, faultConfigBody))
  return formatResponse(toResponse(config), req, res)
})

// Turn every fault off.
router.delete('/', async (req, res) => {
  const config = await saveFaultConfig({ ...NO_FAULTS })
  return formatResponse(toResponse(config), req, res)
})

export default router
