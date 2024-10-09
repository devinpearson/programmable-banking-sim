import express, { Request, Response } from 'express'
const router = express.Router()
import { accessTokens, settings, formatErrorResponse } from '../app.js'
import dayjs from 'dayjs'

router.post('/v2/oauth2/token', (req: Request, res: Response) => {
  try {
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
    if (
      settings.api_key !== '' &&
      req.headers['x-api-key'] !== settings.api_key
    ) {
      return formatErrorResponse(req, res, 401)
    }
    // Generate a token string
    const token =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    const expiryDate = dayjs().add(settings.token_expiry, 'seconds').format()
    accessTokens[token] = { expires_at: expiryDate, scope: 'accounts' }
    return res.json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: settings.token_expiry,
      scope: 'accounts',
    })
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

export default router
