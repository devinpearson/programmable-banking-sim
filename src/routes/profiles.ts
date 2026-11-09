import express from 'express'
import { PrismaClient } from '@prisma/client'
import { formatErrorResponse, formatResponse } from '../app.js'
import { accountAllowed } from '../consent.js'

const router = express.Router()
const prisma = new PrismaClient()

// Investec's Profiles endpoints. Their paths are as in Investec's API
// collection; the response fields are the sandbox's best match, as Investec
// doesn't publish them (see the OpenAPI document).

router.get('/', async (req, res) => {
  const profiles = await prisma.profile.findMany({ orderBy: { profileId: 'asc' } })
  return formatResponse(
    profiles.map((profile, i) => ({
      profileId: profile.profileId,
      profileName: profile.profileName,
      // The sandbox treats the first profile as the default one.
      default: i === 0,
    })),
    req,
    res,
  )
})

// A profile's accounts, in the same shape as GET /za/pb/v1/accounts. A
// 3-legged token sees only the accounts the user consented to.
router.get('/:profileId/accounts', async (req, res) => {
  const profile = await prisma.profile.findUnique({ where: { profileId: req.params.profileId } })
  if (!profile) {
    return formatErrorResponse(req, res, 404)
  }
  const accounts = (await prisma.account.findMany({ where: { profileId: profile.profileId } }))
    .filter(account => accountAllowed(res, account.accountId))
    .map(({ overdraftLimit: _overdraftLimit, ...account }) => account)
  return formatResponse({ accounts }, req, res)
})

export default router
