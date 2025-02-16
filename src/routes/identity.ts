import express, { Request, Response } from 'express'
const router = express.Router()
import {
  accessTokens,
  authorizationCodes,
  sessionTokens,
  refreshTokens,
  settings,
  formatErrorResponse,
} from '../app.js'
import dayjs from 'dayjs'
import { AuthorizationCode } from '../types.js'
import { createHmac } from 'crypto'

router.post('/v2/oauth2/token', (req: Request, res: Response) => {
  try {
    if (req.headers.authorization === undefined) {
      return formatErrorResponse(req, res, 422)
    }
    const authStr = Buffer.from(
      (req.headers.authorization ? req.headers.authorization.split(' ')[1] || '' : ''),
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
    if (req.body.grant_type == 'client_credentials') {
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
        expires_in: settings.token_expiry,
        scope: 'accounts',
      })
    } else if (req.body.grant_type == 'authorization_code') {
      const code = req.body.code
      // const _redirectUri = req.body.redirect_uri
      // need to check the code to see if it is in the authorizationCodes
      const authorizationCode = authorizationCodes[code]
      if (!authorizationCode) {
        return formatErrorResponse(req, res, 401)
      }
      delete authorizationCodes[code]

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
        expires_in: settings.token_expiry,
        scope: authorizationCode.scope,
        refresh_token: refreshToken,
      })
    } else if (req.body.grant_type == 'refresh_token') {
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
        expires_in: settings.token_expiry,
        scope: 'accounts',
        refresh_token: refreshToken,
      })
    }
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/v2/oauth2/authorize', (req: Request, res: Response) => {
  const token = generateToken()
  const authorizationCode: AuthorizationCode = {
    code: token,
    expires_at: dayjs().add(settings.token_expiry, 'seconds').format(),
    scope: req.query.scope as string,
    redirect_uri: req.query.redirect_uri as string,
  }
  if (settings.client_id !== req.query.client_id) {
    return formatErrorResponse(req, res, 401)
  }
  const secret = 'abcdefg';
  const hash = createHmac('sha256', secret)
               .update('I love cupcakes')
               .digest('hex');
  // const responseType = req.query.response_type
  authorizationCodes[authorizationCode.code] = authorizationCode
  sessionTokens[hash] = authorizationCode
  return res.redirect(302, 'localhost:3000/login?qsp=' + hash)
  return res.json({ Location: "localhost:3000/login?qsp=" + hash}).redirect(302, 'localhost:3000/login?qsp=' + hash)
//   return res.redirect(
//     302,
//     authorizationCode.redirect_uri +
//       '?authorizationCode=' +
//       authorizationCode.code +
//       '&status=SUCCESS&code=' +
//       authorizationCode.code,
//   )
})

function generateToken() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  )
}

export default router
