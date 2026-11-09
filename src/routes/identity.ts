import express, { type Request, type Response } from 'express'
const router = express.Router()
import {
  accessTokens,
  authorizationCodes,
  refreshTokens,
  settings,
  formatErrorResponse,
} from '../app.js'
import dayjs from 'dayjs'
import type { AuthorizationCode } from '../types.js'
import { createHmac, randomBytes } from 'node:crypto'

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
router.all('/oauth', (_req: Request, res: Response) => {
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

router.post('/v2/oauth2/token', (req: Request, res: Response) => {
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
    if (req.body.grant_type === 'client_credentials') {
      if (
        settings.api_key !== '' &&
        req.headers['x-api-key'] !== settings.api_key
      ) {
        return formatErrorResponse(req, res, 401)
      }
      // Generate a token string
      const token = generateToken()
      const expiryDate = dayjs().add(settings.token_expiry, 'seconds').format()
      accessTokens[token] = { expires_at: expiryDate, scope: 'accounts' }
      return res.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: +settings.token_expiry,
        scope: 'accounts',
      })
    } else if (req.body.grant_type === 'authorization_code') {
      const code = req.body.code
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
        req.body.redirect_uri &&
        req.body.redirect_uri !== authorizationCode.redirect_uri
      ) {
        return formatErrorResponse(req, res, 401)
      }

      // Generate a token string
      const token = generateToken()
      const refreshToken = generateToken()
      refreshTokens.push(refreshToken)
      const expiryDate = dayjs().add(settings.token_expiry, 'seconds').format()
      accessTokens[token] = {
        expires_at: expiryDate,
        scope: authorizationCode.scope,
      }
      return res.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: +settings.token_expiry,
        scope: authorizationCode.scope,
        refresh_token: refreshToken,
      })
    } else if (req.body.grant_type === 'refresh_token') {
      const incomingToken = req.body.refresh_token
      if (!refreshTokens.includes(incomingToken)) {
        return formatErrorResponse(req, res, 401)
      }
      refreshTokens.splice(refreshTokens.indexOf(incomingToken), 1)

      // Generate a token string
      const token = generateToken()
      const refreshToken = generateToken()
      refreshTokens.push(refreshToken)
      const expiryDate = dayjs().add(settings.token_expiry, 'seconds').format()
      accessTokens[token] = { expires_at: expiryDate, scope: 'accounts' }
      return res.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: +settings.token_expiry,
        scope: 'accounts',
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

router.get('/v2/oauth2/authorize', (req: Request, res: Response) => {
  if (settings.client_id !== req.query.client_id) {
    return formatErrorResponse(req, res, 401)
  }
  const token = generateToken()
  const authorizationCode: AuthorizationCode = {
    code: token,
    expires_at: dayjs().add(settings.token_expiry, 'seconds').format(),
    scope: req.query.scope as string,
    redirect_uri: req.query.redirect_uri as string,
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
  sessionTokens[hash] = { code: authorizationCode, authenticated: false }

  return res.redirect(302, `/login?qsp=${hash}`)
})

router.get('/approve', (req: Request, res: Response) => {
  const qsp = req.query.qsp as string
  const session = sessionTokens[qsp]
  if (!qsp || !session) {
    return formatErrorResponse(req, res, 400)
  }
  // The flow must have been signed in at /login before it can be approved.
  if (!session.authenticated) {
    return formatErrorResponse(req, res, 401)
  }
  const authorizationCode = session.code
  delete sessionTokens[qsp]

  // Approval is what makes the code exchangeable.
  authorizationCodes[authorizationCode.code] = authorizationCode

  const redirectUri = authorizationCode.redirect_uri.startsWith('http')
    ? authorizationCode.redirect_uri
    : `http://${authorizationCode.redirect_uri}`
  return res.redirect(
    302,
    redirectUri +
      '?authorizationCode=' +
      authorizationCode.code +
      '&status=SUCCESS&code=' +
      authorizationCode.code,
  )
})

router.get('/decline', (req: Request, res: Response) => {
  const qsp = req.query.qsp as string
  const session = sessionTokens[qsp]
  if (!qsp || !session) {
    return formatErrorResponse(req, res, 400)
  }
  const authorizationCode = session.code
  delete sessionTokens[qsp]
  // The code was never published to authorizationCodes, so declining leaves
  // nothing exchangeable. The code is echoed back only for request correlation.

  const redirectUri = authorizationCode.redirect_uri.startsWith('http')
    ? authorizationCode.redirect_uri
    : `http://${authorizationCode.redirect_uri}`
  return res.redirect(
    302,
    redirectUri +
      '?authorizationCode=' +
      authorizationCode.code +
      '&status=DECLINED&code=' +
      authorizationCode.code,
  )
})

function generateToken() {
  // Cryptographically random, unguessable token (48 hex chars).
  return randomBytes(24).toString('hex')
}

export default router
