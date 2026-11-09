import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import morgan from 'morgan'
import cors from 'cors'
import dayjs from 'dayjs'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { Server } from 'socket.io'
import { createServer } from 'node:http'
import identity, { authenticateSession } from './routes/identity.js'
import accounts from './routes/accounts.js'
import cards from './routes/cards.js'
import exchangeRates from './routes/exchangeRates.js'
import webhooks from './routes/webhooks.js'
import faults from './routes/faults.js'
import profiles from './routes/profiles.js'
import type {
  AccessToken,
  AuthorizationCode,
  RefreshGrant,
  Settings,
  ControlMessage,
} from './types.js'
import { requiredScope, tokenHasScope } from './consent.js'
import { seedAccounts } from '../prisma/account.js'
import { seedTransactions } from '../prisma/transaction.js'
import { seedBeneficiaries } from '../prisma/beneficiary.js'
import { seedCards } from '../prisma/card.js'
import { seedCardCodes } from '../prisma/card-code.js'
import { seedProfiles } from '../prisma/profile.js'
import { seedExchangeRates } from '../prisma/exchange-rate.js'
import { listScenarios, applyScenario } from './scenarios.js'
import { errorHandler } from './middleware/errorHandler.js'
import { setupOpenApi } from './config/openapi.js'
import { validateRequest, validatedBody } from './middleware/validation.js'
import { authRateLimit } from './middleware/rateLimit.js'
import { injectFaults, loadFaultConfig } from './faults.js'
import { exportState, importState, sandboxStateSchema } from './sandboxState.js'
import { loginBody, settingsBody } from './schema/requestSchemas.js'
import type { z } from 'zod'

dotenv.config()

export const port = process.env.PORT || 3000
// The dashboard and the OAuth login/consent pages are the Next.js app in
// web/, served separately (npm run dev starts both).
export const webUrl = (process.env.WEB_URL || 'http://localhost:3001').replace(/\/$/, '')
// const overdraft = process.env.OVERDRAFT || 5000
const prisma = new PrismaClient()
export const app = express()
export const server = createServer(app)
// The dashboard (another origin) subscribes to live logs and summaries.
const io = new Server(server, { cors: { origin: '*' } })
export let settings = {} as Settings
await fetchSettings()
await loadFaultConfig()

app.use(cors())
// Configuring body parser middleware
app.use(express.urlencoded({ extended: false }))
app.use(morgan('combined'))
// Large enough to import an exported sandbox state (POST /import).
app.use(express.json({ limit: '10mb' }))

export const accessTokens = {} as Record<string, AccessToken>
export const authorizationCodes = {} as Record<string, AuthorizationCode>
export const refreshTokens = new Map<string, RefreshGrant>()

const messageQueue = 'logs'

io.on('connection', socket => {
  // Same rules as POST /envs: validated, saved, and broadcast.
  socket.on('envs', async msg => {
    const parsed = settingsBody.safeParse(msg)
    if (!parsed.success) {
      console.log('Ignoring invalid settings from the socket:', parsed.error.issues)
      return
    }
    await applySettings(parsed.data)
  })
  socket.on('control', async (msg: ControlMessage) => {
    console.log(`control: ${msg}`)
    const { action } = msg // , message
    console.log(`action: ${action}`)
    switch (action) {
      case 'clear':
        await clearDatabase()
        await emitDatabaseSummary()
        break
      case 'restore':
        await restoreDatabase()
        await emitDatabaseSummary()
        break
    }
    //io.emit('control', settings);
  })
  socket.on(messageQueue, msg => {
    console.log(`message: ${msg}`)
    io.emit(messageQueue, msg)
  })
  console.log('a user connected')
  socket.on('disconnect', () => {
    console.log('user disconnected')
  })
})

// The pages live in the web app now; send old links and bookmarks there,
// keeping the query string (the OAuth qsp handle).
function redirectToWeb(path: string) {
  return (req: Request, res: Response) => {
    const query = req.originalUrl.includes('?')
      ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
      : ''
    res.redirect(`${webUrl}${path}${query}`)
  }
}

app.get('/', redirectToWeb('/'))
app.get('/login', redirectToWeb('/login'))
app.get('/wpaas/prog-banking-wpaas/oauth-consent', redirectToWeb('/consent'))
app.get('/guide', redirectToWeb('/guide'))

app.post('/login', authRateLimit, validateRequest({ body: loginBody }), (req, res) => {
  const { email, password, qsp: formQsp } = validatedBody(res, loginBody)
  // The qsp comes in the query string or, from the login page, the form body.
  const qsp = (typeof req.query.qsp === 'string' && req.query.qsp) || formQsp
  
  if (email === 'admin@example.com' && password === 'admin') {
    // Mark the pending OAuth flow as signed in so /approve will accept it.
    if (qsp) {
      authenticateSession(qsp as string)
    }
    // On to the consent page, keeping the flow's qsp.
    const params = new URLSearchParams()
    if (qsp) params.set('qsp', String(qsp))
    const query = params.size > 0 ? `?${params}` : ''
    return res.redirect(`${webUrl}/consent${query}`)
  } else {
    // Back to the login page with an error, keeping the qsp.
    const params = new URLSearchParams({ error: 'invalid_credentials' })
    if (qsp) params.set('qsp', String(qsp))
    return res.redirect(`${webUrl}/login?${params}`)
  }
})

// Save the sandbox settings, use them from now on, and tell dashboards.
async function applySettings(input: z.infer<typeof settingsBody>) {
  const next: Settings = {
    client_id: input.client_id,
    client_secret: input.client_secret,
    api_key: input.api_key,
    token_expiry: input.token_expiry,
    auth: input.auth === true,
  }
  for (const [name, value] of Object.entries(next)) {
    await prisma.setting.upsert({
      where: { name },
      update: { value: String(value) },
      create: { name, value: String(value) },
    })
  }
  settings = next
  io.emit('envs', settings)
  return settings
}

app.post('/envs', validateRequest({ body: settingsBody }), async (_req, res) => {
  return res.json(await applySettings(validatedBody(res, settingsBody)))
})

// Handle legacy /oauth requests
// Express 5 wildcards are named: matches /oauth, /oauth/... and /oauthX.
app.all('/oauth{*rest}', (_req, res) => {
  return res.status(404).json({
    error: 'endpoint_not_found',
    message: 'OAuth endpoints have moved. Use the correct endpoints below.',
    correct_endpoints: {
      token: '/identity/v2/oauth2/token (POST)',
      authorize: '/identity/v2/oauth2/authorize (GET)',
      approve: '/identity/approve (GET)',
      decline: '/identity/decline (GET)'
    },
    examples: {
      get_token: 'POST /identity/v2/oauth2/token',
      start_oauth: 'GET /identity/v2/oauth2/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT' + 
                   '&scope=accounts'
    }
  })
})

// Where each router is mounted; also read by the OpenAPI route check.
export const routerMounts = {
  '/identity': identity,
  '/za/pb/v1/accounts': accounts,
  '/za/v1/cards': cards,
  '/za/pb/v1/profiles': profiles,
  '/exchange-rates': exchangeRates,
  '/webhooks': webhooks,
  '/faults': faults,
} as const

// Token requests check client secrets and the OAuth pages sign users in.
// Fault injection on the token endpoint and the emulated Investec API.
app.use('/identity/v2/oauth2/token', injectFaults)
app.use('/za', injectFaults)
app.use('/identity', authRateLimit, routerMounts['/identity'])
// Check the bearer token when auth is on, and enforce what it was granted:
// its scopes here, its consented accounts in the routers (via res.locals).
app.use('/za', (req, res, next) => {
  if (settings.auth !== true) {
    return next()
  }
  const token = validToken(req)
  if (!token) {
    return formatErrorResponse(req, res, 401)
  }
  const scope = requiredScope(req.method, req.baseUrl + req.path)
  if (scope && !tokenHasScope(token, scope)) {
    return formatErrorResponse(req, res, 403, `Token is missing scope: ${scope}`)
  }
  res.locals.token = token
  next()
})

app.use('/za/pb/v1/accounts', routerMounts['/za/pb/v1/accounts'])
app.use('/za/v1/cards', routerMounts['/za/v1/cards'])
app.use('/za/pb/v1/profiles', routerMounts['/za/pb/v1/profiles'])
// Sandbox control, outside /za so it needs no token.
app.use('/exchange-rates', routerMounts['/exchange-rates'])
app.use('/webhooks', routerMounts['/webhooks'])
app.use('/faults', routerMounts['/faults'])

// Shared database lifecycle helpers, used by the control socket and the
// /clear and /restore routes so every entry point behaves identically.
async function clearDatabase() {
  await prisma.account.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.beneficiary.deleteMany()
  await prisma.card.deleteMany()
  await prisma.cardCode.deleteMany()
  await prisma.profile.deleteMany()
}

async function restoreDatabase() {
  await clearDatabase()
  // Back to the seeded rates too (an import may have replaced them).
  await seedExchangeRates()
  await seedProfiles()
  await seedAccounts()
  await seedTransactions()
  await seedBeneficiaries()
  await seedCards()
  await seedCardCodes()
}

app.delete('/clear', async (req, res) => {
  try {
    await clearDatabase()

    return res.status(200).json()
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

app.get('/restore', async (req, res) => {
  try {
    await restoreDatabase()

    return res.status(200).json()
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// Download the sandbox's data as a JSON file (see src/sandboxState.ts).
app.get('/export', async (req, res) => {
  const state = await exportState()
  const date = state.exportedAt.slice(0, 10)
  res.setHeader('Content-Disposition', `attachment; filename="sandbox-${date}.json"`)
  logRequest(req, 200)
  return res.json(state)
})

// Replace the sandbox's data with an exported state. Validated first; all
// or nothing.
app.post('/import', validateRequest({ body: sandboxStateSchema }), async (req, res) => {
  const counts = await importState(validatedBody(res, sandboxStateSchema))
  await emitDatabaseSummary()
  return formatResponse(counts, req, res)
})

// List the named starting scenarios available to load.
app.get('/scenarios', (req, res) => {
  return formatResponse(listScenarios(), req, res)
})

// Load a named scenario, replacing the current account data.
app.post('/scenarios/:id', async (req, res) => {
  try {
    const result = await applyScenario(req.params.id)
    if (!result) {
      return formatErrorResponse(req, res, 404) // unknown scenario
    }
    await emitDatabaseSummary()
    return formatResponse(result, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

app.get('/envs', async (req, res) => {
  try {
    return formatResponse(settings, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})
app.get('/database-summary', async (req, res) => {
  try {
    const [profileCount, accountCount, cardCount, transactionCount] = await Promise.all([
      prisma.profile.count(),
      prisma.account.count(),
      prisma.card.count(),
      prisma.transaction.count()
    ])
    
    const summary = {
      profiles: profileCount,
      accounts: accountCount,
      cards: cardCount,
      transactions: transactionCount
    }
    
    return formatResponse(summary, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// OpenAPI document and Swagger UI: /api-docs.json, /api-docs.yaml, /swagger-ui.
setupOpenApi(app)

// After every route: JSON for anything a handler threw or rejected with.
app.use(errorHandler)

// The unexpired access token named by the Authorization header, or null.
function validToken(req: Request): AccessToken | null {
  const authorization = req.get('authorization')?.split(' ')[1]
  if (!authorization) {
    return null
  }
  const token = accessTokens[authorization]
  if (token && dayjs().isBefore(token.expires_at)) {
    return token
  }
  return null
}

// Push a named event to every connected dashboard.
export function emitSocketEvent(name: string, payload: unknown) {
  io.sockets.emit(name, payload)
}

export async function emitDatabaseSummary() {
  try {
    const [profileCount, accountCount, cardCount, transactionCount] = await Promise.all([
      prisma.profile.count(),
      prisma.account.count(),
      prisma.card.count(),
      prisma.transaction.count()
    ])
    
    const summary = {
      profiles: profileCount,
      accounts: accountCount,
      cards: cardCount,
      transactions: transactionCount
    }
    
    io.sockets.emit('database-summary', summary)
  } catch (error) {
    console.log('Error emitting database summary:', error)
  }
}

export function formatResponse (data: unknown, req: Request, res: Response) {
  const date = new Date()
  // Don't log database-summary calls as they're internal dashboard calls
  if (req.originalUrl !== '/database-summary') {
    io.sockets.emit(
      messageQueue,
      date.toUTCString() +
        ' ' +
        req.method +
        ' ' +
        req.originalUrl +
        ' HTTP/' +
        req.httpVersion +
        ' ' +
        res.statusCode,
    )
  }
  return res.json({
    data,
    links: {
      self: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    },
    meta: {
      totalPages: 1,
    },
  })
}
// One line in the dashboard's live server log for a request and its outcome
// (a status code, or e.g. "connection dropped (fault: timeout)").
export function logRequest(req: Request, outcome: number | string) {
  io.sockets.emit(
    messageQueue,
    `${new Date().toUTCString()} ${req.method} ${req.originalUrl} HTTP/${req.httpVersion} ${outcome}`,
  )
}

export function formatErrorResponse(
  req: Request,
  res: Response,
  code: number,
  errorMessage?: string,
  extra?: Record<string, unknown>,
) {
  logRequest(req, code)
  // Most errors keep an empty body; pass a message when the caller needs to
  // know *why* (e.g. insufficient funds).
  return res
    .status(code)
    .json(errorMessage ? { errorMessage, ...extra } : undefined)
}

async function fetchSettings() {
  const dbSettings = await prisma.setting.findMany()
  for (let i = 0; i < dbSettings.length; i++) {
    const setting = dbSettings[i]
    switch (setting.name) {
      case 'client_id':
        settings.client_id = setting.value
        break
      case 'client_secret':
        settings.client_secret = setting.value
        break
      case 'api_key':
        settings.api_key = setting.value
        break
      case 'token_expiry':
        settings.token_expiry = Number(setting.value)
        break
      case 'auth':
        if (setting.value === 'true') {
          settings.auth = true
        } else {
          settings.auth = false
        }
        break
    }
  }
}
