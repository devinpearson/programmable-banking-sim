import express from 'express'
const router = express.Router()
import {
  accessTokens,
  authorizationCodes,
  refreshTokens,
  settings,
  formatErrorResponse,
  formatResponse,
  webUrl,
} from '../app.js'
import dayjs from 'dayjs'
import { PrismaClient } from '@prisma/client'
import type { AuthorizationCode } from '../types.js'
import { createHmac, randomBytes } from 'node:crypto'
import { SCOPE_DESCRIPTIONS, SCOPES, parseScopes } from '../consent.js'

const prisma = new PrismaClient()

// Pending 3-legged OAuth flows, keyed by the opaque qsp handed to the browser.
// A flow only becomes `authenticated` once the user signs in at /login, and its
// authorization code is only published to `authorizationCodes` (and so becomes
// exchangeable) when the user approves.
interface OAuthSession {
  code: AuthorizationCode
  authenticated: boolean
}
const sessionTokens = new Map<string, OAuthSession>()

// Marks a pending flow as signed-in. Called by the /login handler after it
// verifies the user's credentials. Returns false for an unknown qsp.
export function authenticateSession(qsp: string): boolean {
  const session = sessionTokens.get(qsp)
  if (!session) {
    return false
  }
  session.authenticated = true
  return true
}

// Redirect legacy /oauth requests to correct endpoint
router.all('/oauth', (_req, res) => {
  return res.status(404).json({
    error: 'endpoint_not_found',
    message: 'OAuth endpoints have moved. Use /identity/v2/oauth2/token for token requests ' +
             'and /identity/v2/oauth2/authorize for authorization.',
    correct_endpoints: {
      token: '/identity/v2/oauth2/token (POST)',
      authorize: '/identity/v2/oauth2/authorize (GET)',
      approve: '/identity/approve (GET)',
      decline: '/identity/decline (GET)'
    }
  })
})

router.post('/v2/oauth2/token', (req, res) => {
  try {
    if (req.headers.authorization === undefined) {
      return formatErrorResponse(req, res, 422)
    }
    const authStr = Buffer.from(
      (req.headers.authorization ?? '').split(' ')[1],
      'base64',
    ).toString()
    const [clientId, clientSecret] = authStr.split(':')

    if (settings.client_id !== '' && settings.client_secret !== '') {
      if (
        clientId !== settings.client_id ||
        clientSecret !== settings.client_secret
      ) {
        return formatErrorResponse(req, res, 401)
      }
    }
    // Express 5 leaves req.body undefined when nothing was sent.
    const body = req.body ?? {}
    if (body.grant_type === 'client_credentials') {
      if (
        settings.api_key !== '' &&
        req.headers['x-api-key'] !== settings.api_key
      ) {
        return formatErrorResponse(req, res, 401)
      }
      // Generate a token string
      const token = generateToken()
      const expiryDate = dayjs().add(settings.token_expiry, 'seconds').format()
      accessTokens[token] = {
        expires_at: expiryDate,
        scope: 'accounts',
        grant: 'client_credentials',
        accounts: null,
      }
      return res.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: +settings.token_expiry,
        scope: 'accounts',
      })
    } else if (body.grant_type === 'authorization_code') {
      const code = body.code
      const authorizationCode = authorizationCodes[code]
      if (!authorizationCode) {
        return formatErrorResponse(req, res, 401)
      }
      // Authorization codes are single-use.
      delete authorizationCodes[code]
      // Reject an expired code.
      if (dayjs().isAfter(authorizationCode.expires_at)) {
        return formatErrorResponse(req, res, 401)
      }
      // If a redirect_uri is supplied it must match the one from /authorize.
      if (
        body.redirect_uri &&
        body.redirect_uri !== authorizationCode.redirect_uri
      ) {
        return formatErrorResponse(req, res, 401)
      }

      // Generate a token string
      const token = generateToken()
      const refreshToken = generateToken()
      const grant = {
        scope: authorizationCode.scope,
        accounts: authorizationCode.accounts,
      }
      refreshTokens.set(refreshToken, grant)
      const expiryDate = dayjs().add(settings.token_expiry, 'seconds').format()
      accessTokens[token] = {
        expires_at: expiryDate,
        grant: 'authorization_code',
        ...grant,
      }
      return res.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: +settings.token_expiry,
        scope: authorizationCode.scope,
        refresh_token: refreshToken,
      })
    } else if (body.grant_type === 'refresh_token') {
      const incomingToken = body.refresh_token
      const grant = refreshTokens.get(incomingToken)
      if (!grant) {
        return formatErrorResponse(req, res, 401)
      }
      // Refresh tokens are single-use (rotated).
      refreshTokens.delete(incomingToken)

      // The new tokens carry the original grant's scope and accounts.
      const token = generateToken()
      const refreshToken = generateToken()
      refreshTokens.set(refreshToken, grant)
      const expiryDate = dayjs().add(settings.token_expiry, 'seconds').format()
      accessTokens[token] = {
        expires_at: expiryDate,
        grant: 'authorization_code',
        ...grant,
      }
      return res.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: +settings.token_expiry,
        scope: grant.scope,
        refresh_token: refreshToken,
      })
    }
    // Unknown or missing grant_type: respond instead of hanging the request.
    return formatErrorResponse(req, res, 400)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/v2/oauth2/authorize', (req, res) => {
  if (settings.client_id !== req.query.client_id) {
    return formatErrorResponse(req, res, 401)
  }
  // Only the authorization code flow exists. response_type is optional, but
  // clients such as Investec's Postman collection send response_type=code.
  const responseType = req.query.response_type
  if (responseType !== undefined && responseType !== 'code') {
    return formatErrorResponse(req, res, 400, 'Unsupported response_type: only code is supported')
  }
  const redirectUri = req.query.redirect_uri
  if (typeof redirectUri !== 'string' || !isValidRedirectUri(redirectUri)) {
    return formatErrorResponse(req, res, 400, 'redirect_uri must be a valid URL')
  }
  // No scope requests every scope; an unknown one is rejected.
  const scope = parseScopes(req.query.scope)
  if (!scope) {
    return formatErrorResponse(
      req,
      res,
      400,
      `Unknown scope. Valid scopes: ${SCOPES.join(', ')}`,
    )
  }
  const token = generateToken()
  const authorizationCode: AuthorizationCode = {
    code: token,
    expires_at: dayjs().add(settings.token_expiry, 'seconds').format(),
    scope,
    redirect_uri: redirectUri,
    state: typeof req.query.state === 'string' ? req.query.state : undefined,
    accounts: null,
  }

  // Opaque handle for the browser leg of the flow.
  const secret = process.env.OAUTH_SECRET || 'default-oauth-secret-change-in-production'
  const dataToHash = `${authorizationCode.code}:${authorizationCode.expires_at}:` +
                     `${authorizationCode.scope}:${Date.now()}`
  const hash = createHmac('sha256', secret)
               .update(dataToHash)
               .digest('hex')

  // The code is NOT published to authorizationCodes here: it only becomes
  // exchangeable once the user signs in and approves (see /approve).
  sessionTokens.set(hash, { code: authorizationCode, authenticated: false })

  // The user signs in on the web app's login page.
  return res.redirect(302, `${webUrl}/login?qsp=${hash}`)
})

// What the consent page shows for a signed-in flow: the requested scopes and
// the accounts the user can choose from. Served here (not from /za) because
// the browser has no access token yet.
router.get('/consent', async (req, res) => {
  try {
    const session = sessionTokens.get(req.query.qsp as string)
    if (!session) {
      return formatErrorResponse(req, res, 400)
    }
    if (!session.authenticated) {
      return formatErrorResponse(req, res, 401)
    }
    const accounts = await prisma.account.findMany({
      select: { accountId: true, accountNumber: true, accountName: true, productName: true },
    })
    const scopes = session.code.scope.split(' ').map(scope => ({
      scope,
      description: SCOPE_DESCRIPTIONS[scope as keyof typeof SCOPE_DESCRIPTIONS],
    }))
    return formatResponse({ scopes, accounts }, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// Account numbers the consent page posted, as account ids. undefined when
// nothing was selected (consent to every account); null when malformed.
async function consentedAccountIds(selected: unknown) {
  if (selected === undefined || selected === '') {
    return undefined
  }
  let numbers: unknown
  try {
    numbers = JSON.parse(String(selected))
  } catch {
    return null
  }
  if (!Array.isArray(numbers) || !numbers.every(n => typeof n === 'string')) {
    return null
  }
  if (numbers.length === 0) {
    return undefined
  }
  const accounts = await prisma.account.findMany({
    where: { accountNumber: { in: numbers } },
    select: { accountId: true },
  })
  return accounts.map(account => account.accountId)
}

// A redirect_uri without a scheme is treated as http://, as before.
function withScheme(redirectUri: string) {
  return redirectUri.startsWith('http') ? redirectUri : `http://${redirectUri}`
}

function isValidRedirectUri(redirectUri: string) {
  if (redirectUri === '') {
    return false
  }
  try {
    new URL(withScheme(redirectUri))
    return true
  } catch {
    return false
  }
}

// The client's redirect_uri with the result appended, plus state if given.
function redirectWith(code: AuthorizationCode, status: 'SUCCESS' | 'DECLINED') {
  const url = new URL(withScheme(code.redirect_uri))
  url.searchParams.set('authorizationCode', code.code)
  url.searchParams.set('status', status)
  url.searchParams.set('code', code.code)
  if (code.state !== undefined) {
    url.searchParams.set('state', code.state)
  }
  return url.toString()
}

router.get('/approve', async (req, res) => {
  try {
    const qsp = req.query.qsp as string
    const session = sessionTokens.get(qsp)
    if (!qsp || !session) {
      return formatErrorResponse(req, res, 400)
    }
    // The flow must have been signed in at /login before it can be approved.
    if (!session.authenticated) {
      return formatErrorResponse(req, res, 401)
    }
    const accounts = await consentedAccountIds(req.query.selectedAccounts)
    if (accounts === null) {
      return formatErrorResponse(req, res, 400, 'selectedAccounts must be a JSON array of account numbers')
    }
    const authorizationCode = session.code
    authorizationCode.accounts = accounts ?? null
    sessionTokens.delete(qsp)

    // Approval is what makes the code exchangeable.
    authorizationCodes[authorizationCode.code] = authorizationCode

    return res.redirect(302, redirectWith(authorizationCode, 'SUCCESS'))
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/decline', (req, res) => {
  const qsp = req.query.qsp as string
  const session = sessionTokens.get(qsp)
  if (!qsp || !session) {
    return formatErrorResponse(req, res, 400)
  }
  const authorizationCode = session.code
  sessionTokens.delete(qsp)
  // The code was never published to authorizationCodes, so declining leaves
  // nothing exchangeable. The code is echoed back only for request correlation.
  return res.redirect(302, redirectWith(authorizationCode, 'DECLINED'))
})

function generateToken() {
  // Cryptographically random, unguessable token (48 hex chars).
  return randomBytes(24).toString('hex')
}

export default router
