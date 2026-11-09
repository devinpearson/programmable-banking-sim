import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi'
import type { Application } from 'express'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yaml'
import { z } from '../schema/zod.js'
import * as request from '../schema/requestSchemas.js'
import * as response from '../schema/responseSchemas.js'

// The OpenAPI document, generated from the same zod schemas that validate
// requests. Written to openapi/ by `npm run openapi:generate`, checked by
// `npm run openapi:check`, and served at /api-docs.

const registry = new OpenAPIRegistry()

const bearer = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'An access token from POST /identity/v2/oauth2/token. Only required when the sandbox has auth turned on.',
})
const basic = registry.registerComponent('securitySchemes', 'clientCredentials', {
  type: 'http',
  scheme: 'basic',
  description: 'client_id:client_secret',
})

type Method = RouteConfig['method']

interface Operation {
  tag: string
  summary: string
  description?: string
  // Sandbox-only endpoints have no Investec equivalent.
  sandbox?: boolean
  params?: z.AnyZodObject
  query?: z.AnyZodObject | z.ZodEffects<z.AnyZodObject>
  body?: z.ZodTypeAny
  bodyType?: 'application/json' | 'application/x-www-form-urlencoded'
  // The 200 body; null for an empty one. Redirects set `redirect` instead.
  ok?: z.ZodTypeAny | null
  redirect?: string
  errors?: number[]
  security?: 'bearer' | 'basic' | 'none'
}

const ERROR_TEXT: Record<number, string> = {
  400: 'Invalid request',
  401: 'Missing or expired token (when auth is on)',
  403: 'Token lacks the scope or account consent',
  404: 'Not found',
  409: 'Already exists',
  422: 'Not possible in the current state (e.g. insufficient funds)',
  429: 'Too many sign-in or identity requests (AUTH_RATE_LIMIT per minute); see Retry-After',
}

// OpenAPI paths use {param}; Express uses :param.
export function toOpenApiPath(path: string) {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
}

function pathParams(path: string): z.AnyZodObject | undefined {
  const names = [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map(match => match[1])
  if (names.length === 0) return undefined
  return z.object(Object.fromEntries(names.map(name => [name, z.string()])))
}

// Rate-limited by authRateLimit (src/middleware/rateLimit.ts).
function isRateLimited(path: string) {
  return path === '/login' || path.startsWith('/identity/')
}

function register(method: Method, path: string, op: Operation) {
  const errors = new Set(op.errors ?? [])
  if (isRateLimited(path)) errors.add(429)
  if (op.body || op.query) errors.add(400)
  if (path.includes(':')) errors.add(404)
  const security =
    op.security === 'none' ? [] : op.security === 'basic' ? [{ [basic.name]: [] }] : [{ [bearer.name]: [] }]
  const responses: RouteConfig['responses'] = {}
  if (op.redirect) {
    responses[302] = { description: op.redirect }
  } else {
    responses[200] = op.ok
      ? { description: 'OK', content: { 'application/json': { schema: op.ok } } }
      : { description: 'OK (empty body)' }
  }
  for (const status of [...errors].sort()) {
    responses[status] = {
      description: ERROR_TEXT[status] ?? 'Error',
      content: { 'application/json': { schema: response.ErrorResponse } },
    }
  }
  registry.registerPath({
    method,
    path: toOpenApiPath(path),
    tags: [op.tag],
    summary: op.summary,
    description: op.description,
    security,
    request: {
      params: op.params ?? pathParams(path),
      query: op.query as z.AnyZodObject | undefined,
      body: op.body
        ? { content: { [op.bodyType ?? 'application/json']: { schema: op.body } } }
        : undefined,
    },
    responses,
    ...(op.sandbox ? { 'x-sandbox-only': true } : {}),
  })
}

const ACCOUNTS = '/za/pb/v1/accounts'
const CARDS = '/za/v1/cards'
const accountErrors = [401, 403]

// --- Accounts ---------------------------------------------------------------
register('get', ACCOUNTS, {
  tag: 'Accounts',
  summary: 'List accounts',
  description: 'A 3-legged token sees only the accounts the user consented to.',
  ok: response.envelope(z.object({ accounts: z.array(response.Account) })),
  errors: accountErrors,
})
register('post', ACCOUNTS, {
  tag: 'Accounts',
  summary: 'Create an account',
  sandbox: true,
  body: request.createAccountBody,
  ok: response.envelope(response.Account),
  errors: [...accountErrors, 409, 422],
})
register('delete', `${ACCOUNTS}/:accountId`, {
  tag: 'Accounts',
  summary: 'Delete an account with its transactions and cards',
  sandbox: true,
  ok: null,
  errors: accountErrors,
})
register('get', `${ACCOUNTS}/:accountId/balance`, {
  tag: 'Accounts',
  summary: 'Get the balance',
  ok: response.envelope(response.Balance),
  errors: accountErrors,
})
register('get', `${ACCOUNTS}/:accountId/transactions`, {
  tag: 'Transactions',
  summary: 'List transactions, newest first',
  query: request.transactionsQuery,
  ok: response.envelope(z.object({ transactions: z.array(response.Transaction) })),
  errors: accountErrors,
})
register('post', `${ACCOUNTS}/:accountId/transactions`, {
  tag: 'Transactions',
  summary: 'Create a transaction',
  description: 'Only card transactions (CardPurchases, CardWithdrawals) may be PENDING unless allowNonCardPending=true.',
  sandbox: true,
  query: request.allowNonCardPendingQuery,
  body: request.createTransactionBody,
  ok: response.envelope(response.StoredTransaction),
  errors: accountErrors,
})
register('post', `${ACCOUNTS}/:accountId/transactions/settle`, {
  tag: 'Transactions',
  summary: "Settle all of an account's pending transactions",
  sandbox: true,
  ok: response.envelope(z.object({ settled: z.number().int() })),
  errors: accountErrors,
})
register('delete', `${ACCOUNTS}/:accountId/transactions/:postingDate`, {
  tag: 'Transactions',
  summary: 'Delete the transactions posted on a date',
  sandbox: true,
  ok: null,
  errors: accountErrors,
})
register('get', `${ACCOUNTS}/:accountId/pending-transactions`, {
  tag: 'Transactions',
  summary: 'List pending transactions (card holds)',
  ok: response.envelope(z.object({ pendingTransactions: z.array(response.PendingTransaction) })),
  errors: accountErrors,
})
register('post', `${ACCOUNTS}/:accountId/pending-transactions/:transactionId/settle`, {
  tag: 'Transactions',
  summary: 'Settle one pending transaction',
  sandbox: true,
  ok: response.envelope(response.Transaction),
  errors: accountErrors,
})
register('delete', `${ACCOUNTS}/:accountId/pending-transactions/:transactionId`, {
  tag: 'Transactions',
  summary: 'Reverse one pending transaction, releasing the funds',
  sandbox: true,
  ok: z.object({}),
  errors: accountErrors,
})
register('post', `${ACCOUNTS}/:accountId/topup`, {
  tag: 'Transactions',
  summary: 'Top up an account (one CREDIT)',
  sandbox: true,
  body: request.topUpBody,
  ok: response.envelope(response.StoredTransaction),
  errors: accountErrors,
})
register('post', `${ACCOUNTS}/:accountId/transfermultiple`, {
  tag: 'Transfers and payments',
  summary: 'Transfer between accounts (up to 50)',
  description: 'The whole batch must fit the available balance (422 otherwise). Both accounts must be consented.',
  body: request.transferMultipleBody,
  ok: response.envelope(z.array(response.TransferLeg)),
  errors: [...accountErrors, 422],
})
register('post', `${ACCOUNTS}/:accountId/paymultiple`, {
  tag: 'Transfers and payments',
  summary: 'Pay beneficiaries (up to 50)',
  description: 'The whole batch must fit the available balance (422 otherwise).',
  body: request.payMultipleBody,
  ok: response.envelope(z.array(response.PaymentLeg)),
  errors: [...accountErrors, 422],
})
register('get', `${ACCOUNTS}/beneficiaries`, {
  tag: 'Beneficiaries',
  summary: 'List beneficiaries',
  ok: response.envelope(z.object({ result: z.array(response.Beneficiary) })),
  errors: accountErrors,
})
register('post', `${ACCOUNTS}/beneficiaries`, {
  tag: 'Beneficiaries',
  summary: 'Create a beneficiary',
  sandbox: true,
  body: request.createBeneficiaryBody,
  ok: response.envelope(response.Beneficiary),
  errors: [...accountErrors, 409],
})
register('delete', `${ACCOUNTS}/beneficiaries/:beneficiaryId`, {
  tag: 'Beneficiaries',
  summary: 'Delete a beneficiary',
  sandbox: true,
  ok: z.object({}),
  errors: accountErrors,
})
register('get', `${ACCOUNTS}/beneficiarycategories`, {
  tag: 'Beneficiaries',
  summary: 'List beneficiary categories',
  ok: response.envelope(z.array(response.BeneficiaryCategory)),
  errors: accountErrors,
})
register('get', `${ACCOUNTS}/:accountId/documents`, {
  tag: 'Documents',
  summary: 'List statements',
  ok: response.envelope(z.object({ documents: z.array(response.DocumentSummary) })),
  errors: accountErrors,
})
register('get', `${ACCOUNTS}/:accountId/documents/:documentType/:documentDate`, {
  tag: 'Documents',
  summary: 'Get a statement (placeholder descriptor)',
  ok: response.envelope(response.DocumentDetail),
  errors: accountErrors,
})

// --- Cards ------------------------------------------------------------------
register('get', CARDS, {
  tag: 'Cards',
  summary: 'List cards',
  ok: response.envelope(z.object({ cards: z.array(response.Card) })),
  errors: accountErrors,
})
register('post', CARDS, {
  tag: 'Cards',
  summary: 'Issue a card',
  description:
    "Given an accountId (which must exist), the card swipes against that account and takes its account number. Defaults: a masked card number, status Active, and the starter code saved and published.",
  sandbox: true,
  body: request.createCardBody,
  ok: response.envelope(response.CreatedCard),
  errors: [...accountErrors, 409, 422],
})
register('delete', `${CARDS}/:cardKey`, { tag: 'Cards', summary: 'Delete a card', sandbox: true, ok: null, errors: accountErrors })
register('post', `${CARDS}/:cardKey/status`, {
  tag: 'Cards',
  summary: 'Stop or reactivate a card',
  sandbox: true,
  body: request.cardStatusBody,
  ok: response.envelope(z.object({ cardKey: z.string(), status: z.enum(['Active', 'Stopped']) })),
  errors: accountErrors,
})
register('post', `${CARDS}/:cardKey/toggle-programmable-feature`, {
  tag: 'Cards',
  summary: 'Turn the programmable feature on or off',
  body: request.toggleProgrammableBody,
  ok: z.object({ Enabled: z.boolean() }),
  errors: accountErrors,
})
for (const [path, summary] of [
  ['code', 'Get the saved code'],
  ['publishedcode', 'Get the published code'],
] as const) {
  register('get', `${CARDS}/:cardKey/${path}`, { tag: 'Card code', summary, ok: response.envelope(response.CardCode), errors: accountErrors })
}
for (const [path, summary] of [
  ['code', 'Save code'],
  ['publishedcode', 'Publish code'],
] as const) {
  register('post', `${CARDS}/:cardKey/${path}`, {
    tag: 'Card code',
    summary,
    body: request.cardCodeBody,
    ok: response.envelope(response.CardCode),
    errors: accountErrors,
  })
}
register('get', `${CARDS}/:cardKey/environmentvariables`, {
  tag: 'Card code',
  summary: 'Get environment variables',
  ok: response.envelope(response.EnvironmentVariables),
  errors: accountErrors,
})
register('post', `${CARDS}/:cardKey/environmentvariables`, {
  tag: 'Card code',
  summary: 'Replace environment variables',
  body: request.environmentVariablesBody,
  ok: response.envelope(response.EnvironmentVariables),
  errors: accountErrors,
})
register('post', `${CARDS}/:cardKey/code/execute`, {
  tag: 'Card code',
  summary: 'Simulate a transaction against code you supply',
  body: request.executeCodeBody,
  ok: response.envelope(z.object({ result: z.array(response.Execution.omit({ cardKey: true })) })),
  errors: accountErrors,
})
register('post', `${CARDS}/:cardKey/code/execute-live`, {
  errors: [...accountErrors, 422],
  tag: 'Card code',
  summary: 'Swipe the card (point of sale)',
  description:
    "Runs the published code. Any currency with an exchange rate works: the card code sees the purchase in its own currency, and the account is charged in rand. Declined up front if the card is stopped or the account can't cover the rand amount; an approved swipe places a pending hold (or posts immediately with settle: true). 422 when the currency has no exchange rate.",
  sandbox: true,
  body: request.executeLiveBody,
  ok: response.envelope(response.SwipeResult),
})
register('get', `${CARDS}/:cardKey/code/executions`, {
  tag: 'Card code',
  summary: 'List code executions and their logs',
  ok: response.envelope(z.object({ executions: z.array(response.Execution) })),
  errors: accountErrors,
})
for (const [path, summary] of [
  ['countries', 'List countries'],
  ['currencies', 'List currencies'],
  ['merchants', 'List merchant categories'],
] as const) {
  register('get', `${CARDS}/${path}`, { tag: 'Cards', summary, ok: response.envelope(response.ReferenceList), errors: accountErrors })
}

// --- Exchange rates ---------------------------------------------------------
register('get', '/exchange-rates', {
  tag: 'Exchange rates',
  summary: 'List exchange rates for foreign card swipes',
  sandbox: true,
  security: 'none',
  ok: response.envelope(z.object({ rates: z.array(response.ExchangeRate) })),
})
register('put', '/exchange-rates/:currencyCode', {
  tag: 'Exchange rates',
  summary: "Add a currency or change its rate",
  description: 'Rand per unit of the currency. ZAR is always 1.',
  sandbox: true,
  security: 'none',
  params: request.currencyCodeParams,
  body: request.exchangeRateBody,
  ok: response.envelope(response.ExchangeRate),
})
register('delete', '/exchange-rates/:currencyCode', {
  tag: 'Exchange rates',
  summary: 'Remove a currency (swipes in it are then refused)',
  sandbox: true,
  security: 'none',
  params: request.currencyCodeParams,
  ok: z.object({}),
})

// --- Webhooks ---------------------------------------------------------------
const webhookIdParams = request.webhookIdParams
register('get', '/webhooks', {
  tag: 'Webhooks',
  summary: 'List webhooks',
  sandbox: true,
  security: 'none',
  ok: response.envelope(z.object({ webhooks: z.array(response.Webhook) })),
})
register('get', '/webhooks/events', {
  tag: 'Webhooks',
  summary: 'List the events webhooks can receive',
  sandbox: true,
  security: 'none',
  ok: response.envelope(z.object({ events: z.array(z.string()) })),
})
register('post', '/webhooks', {
  tag: 'Webhooks',
  summary: 'Register a webhook',
  description:
    'Events are POSTed as JSON with X-Sandbox-Event, X-Sandbox-Delivery and, with a secret, X-Sandbox-Signature: sha256=<HMAC-SHA256 of the raw body>. See the webhooks section for each payload.',
  sandbox: true,
  security: 'none',
  body: request.createWebhookBody,
  ok: response.envelope(response.Webhook),
})
register('patch', '/webhooks/:webhookId', {
  tag: 'Webhooks',
  summary: 'Change, pause or resume a webhook',
  sandbox: true,
  security: 'none',
  params: webhookIdParams,
  body: request.updateWebhookBody,
  ok: response.envelope(response.Webhook),
})
register('delete', '/webhooks/:webhookId', {
  tag: 'Webhooks',
  summary: 'Delete a webhook and its delivery log',
  sandbox: true,
  security: 'none',
  params: webhookIdParams,
  ok: z.object({}),
})
register('post', '/webhooks/:webhookId/test', {
  tag: 'Webhooks',
  summary: 'Send a webhook.test event now',
  sandbox: true,
  security: 'none',
  params: webhookIdParams,
  ok: response.envelope(response.WebhookDelivery),
})
register('get', '/webhooks/:webhookId/deliveries', {
  tag: 'Webhooks',
  summary: 'Recent delivery attempts, newest first',
  sandbox: true,
  security: 'none',
  params: webhookIdParams,
  query: request.deliveriesQuery,
  ok: response.envelope(z.object({ deliveries: z.array(response.WebhookDelivery) })),
})

// The deliveries themselves, as OpenAPI 3.1 webhooks.
const deliveryHeaders = z.object({
  'X-Sandbox-Event': z.string(),
  'X-Sandbox-Delivery': z.string(),
  'X-Sandbox-Signature': z.string().optional().openapi({ description: 'sha256=<hex HMAC of the body>, when the webhook has a secret' }),
})
const WEBHOOK_PAYLOADS: [string, string, z.ZodTypeAny][] = [
  ['transaction.posted', 'A transaction posted (top-up, transfer or payment leg, posted swipe, settled hold).', response.StoredTransaction],
  ['transaction.pending', 'A card hold was placed.', response.StoredTransaction],
  ['transaction.reversed', 'A pending hold was reversed.', response.StoredTransaction],
  ['card.authorization', 'A live card swipe was approved or declined.', response.CardAuthorizationEvent],
  ['webhook.test', 'Sent by POST /webhooks/{webhookId}/test.', z.object({ message: z.string() })],
]
// Schemas used only by webhooks aren't collected from them automatically.
registry.register('CardAuthorizationEvent', response.CardAuthorizationEvent)
for (const [event, summary, data] of WEBHOOK_PAYLOADS) {
  registry.registerWebhook({
    method: 'post',
    path: event,
    tags: ['Webhooks'],
    summary,
    request: {
      headers: deliveryHeaders,
      body: { content: { 'application/json': { schema: response.webhookEnvelope(event, data) } } },
    },
    responses: { 200: { description: 'Any 2xx marks the delivery as delivered.' } },
  })
}

// --- Identity (OAuth) -------------------------------------------------------
const tokenBody = z
  .object({
    grant_type: z.enum(['client_credentials', 'authorization_code', 'refresh_token']),
    code: z.string().optional().openapi({ description: 'authorization_code grant' }),
    redirect_uri: z.string().optional().openapi({ description: 'authorization_code grant; must match /authorize' }),
    refresh_token: z.string().optional().openapi({ description: 'refresh_token grant' }),
  })
  .openapi('TokenRequest')

register('post', '/identity/v2/oauth2/token', {
  tag: 'Identity',
  summary: 'Get an access token',
  description: 'client_credentials also needs the x-api-key header when an API key is set.',
  security: 'basic',
  body: tokenBody,
  bodyType: 'application/x-www-form-urlencoded',
  ok: response.TokenResponse,
  errors: [401, 422],
})
register('get', '/identity/v2/oauth2/authorize', {
  tag: 'Identity',
  summary: 'Start the 3-legged flow',
  security: 'none',
  query: z.object({
    client_id: z.string(),
    redirect_uri: z.string().openapi({ example: 'http://localhost:8080/callback' }),
    scope: z.string().optional().openapi({
      description: 'Space-separated: accounts balances transactions transfers beneficiarypayments statements cards. Omit for all.',
    }),
    state: z.string().optional().openapi({ description: 'Echoed back on the redirect.' }),
  }),
  redirect: "To the web app's login page",
  errors: [400, 401],
})
const qspQuery = z.object({ qsp: z.string().openapi({ description: 'The sign-in request handle' }) })
register('get', '/identity/consent', {
  tag: 'Identity',
  summary: 'What the consent page shows for a signed-in request',
  sandbox: true,
  security: 'none',
  query: qspQuery,
  ok: response.envelope(response.ConsentDetails),
  errors: [401],
})
register('get', '/identity/approve', {
  tag: 'Identity',
  summary: 'Approve a signed-in request',
  security: 'none',
  query: qspQuery.extend({
    selectedAccounts: z.string().optional().openapi({ description: 'JSON array of consented account numbers; omit for all.' }),
  }),
  redirect: 'To redirect_uri with code, status=SUCCESS and state',
  errors: [401],
})
register('get', '/identity/decline', {
  tag: 'Identity',
  summary: 'Decline a request',
  security: 'none',
  query: qspQuery,
  redirect: 'To redirect_uri with status=DECLINED and state',
})
register('post', '/login', {
  tag: 'Identity',
  summary: 'Sign in (the login page posts here)',
  sandbox: true,
  security: 'none',
  body: request.loginBody,
  bodyType: 'application/x-www-form-urlencoded',
  redirect: "To the web app's consent page, or back to login with error=invalid_credentials",
})

// --- Sandbox ----------------------------------------------------------------
register('get', '/health', { tag: 'Sandbox', summary: 'Health check', sandbox: true, security: 'none', ok: z.object({ status: z.literal('ok') }) })
register('get', '/envs', { tag: 'Sandbox', summary: 'Get settings', sandbox: true, security: 'none', ok: response.envelope(response.Settings) })
register('post', '/envs', {
  tag: 'Sandbox',
  summary: 'Save settings',
  sandbox: true,
  security: 'none',
  body: request.settingsBody,
  ok: response.Settings,
})
register('get', '/database-summary', {
  tag: 'Sandbox',
  summary: 'Count profiles, accounts, cards and transactions',
  sandbox: true,
  security: 'none',
  ok: response.envelope(response.DatabaseSummary),
})
register('get', '/scenarios', {
  tag: 'Sandbox',
  summary: 'List scenarios',
  sandbox: true,
  security: 'none',
  ok: response.envelope(z.array(response.Scenario)),
})
register('post', '/scenarios/:id', {
  tag: 'Sandbox',
  summary: 'Load a scenario (replaces accounts, transactions, beneficiaries and cards)',
  sandbox: true,
  security: 'none',
  ok: response.envelope(response.ScenarioLoaded),
})
register('get', '/restore', { tag: 'Sandbox', summary: 'Reset to the seed data', sandbox: true, security: 'none', ok: null })
register('delete', '/clear', { tag: 'Sandbox', summary: 'Remove all data', sandbox: true, security: 'none', ok: null })

// OpenAPI 3.1, so a nullable reference is a plain anyOf [ref, null] that
// openapi-typescript understands (3.0 can't express it cleanly).
export const openApiDocument = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'Programmable Banking Sandbox API',
    version: '1.2.0',
    description:
      'A local sandbox emulating the Investec Programmable Banking APIs. Operations marked x-sandbox-only have no Investec equivalent.',
  },
  servers: [{ url: 'http://localhost:3000' }],
})

// Routes the API mounts that are deliberately not documented: redirects to
// the web app, the legacy /oauth hint, and these docs routes.
export const UNDOCUMENTED_ROUTES = new Set([
  'get /',
  'get /login',
  'get /guide',
  'get /wpaas/prog-banking-wpaas/oauth-consent',
  'all /oauth{*rest}',
  'all /identity/oauth',
  'get /api-docs',
  'get /api-docs.json',
  'get /api-docs.yaml',
])

export function setupOpenApi(app: Application) {
  app.get('/api-docs.json', (_req, res) => {
    res.json(openApiDocument)
  })
  app.get('/api-docs.yaml', (_req, res) => {
    res.type('application/x-yaml').send(YAML.stringify(openApiDocument))
  })
  app.use(
    '/swagger-ui',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Programmable Banking Sandbox API',
      swaggerOptions: { docExpansion: 'none' },
    }),
  )
  app.get('/api-docs', (_req, res) => {
    res.redirect(302, '/swagger-ui')
  })
}
