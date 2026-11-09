import { z } from './zod.js'
import { WEBHOOK_EVENTS } from '../webhookEvents.js'

// Request schemas for validateRequest (src/middleware/validation.ts).
//
// Investec API endpoints strip unknown fields, as a real API client may send
// extras. Sandbox-only endpoints that create records reject unknown fields:
// their bodies are written to the database, and a typo there used to
// surface as a 500.

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/

const date = z
  .string()
  .regex(DATE_FORMAT, 'must use YYYY-MM-DD format')
  .refine(value => {
    // A badly formatted date is reported by the regex above, once.
    if (!DATE_FORMAT.test(value)) return true
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'must be a valid calendar date')
  .openapi({ example: '2026-01-31' })

// Amounts may arrive as numbers or numeric strings ("125.50").
const amount = z
  .union([z.number(), z.string().trim().regex(/^\d+(\.\d+)?$/, 'must be a number')])
  .transform(Number)
  .pipe(z.number().positive('must be greater than zero').finite())
  .openapi({ type: 'number', example: 125.5 })

const booleanString = z.enum(['true', 'false']).transform(value => value === 'true')

// --- Accounts ---------------------------------------------------------------

export const transactionsQuery = z
  .object({
    fromDate: date.optional().openapi({ description: 'Earliest posting date. Defaults to 180 days ago.' }),
    toDate: date.optional().openapi({ description: 'Latest posting date. Defaults to today.' }),
    transactionType: z.string().min(1).optional().openapi({ example: 'CardPurchases' }),
    includePending: booleanString.optional().openapi({ description: 'Include pending card holds (listed first).' }),
  })
  .superRefine((value, context) => {
    if (value.fromDate && value.toDate && value.fromDate > value.toDate) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['toDate'], message: 'must be on or after fromDate' })
    }
  })

// The real API accepts at most 50 transfers or payments per request.
const MAX_BATCH = 50

export const transferMultipleBody = z.object({
  transferList: z
    .array(
      z.object({
        beneficiaryAccountId: z.string().min(1),
        amount,
        myReference: z.string().default(''),
        theirReference: z.string().default(''),
      }),
    )
    .min(1, 'must contain at least one transfer')
    .max(MAX_BATCH, `must contain at most ${MAX_BATCH} transfers`),
  profileId: z.string().optional(),
})

export const payMultipleBody = z.object({
  paymentList: z
    .array(
      z.object({
        beneficiaryId: z.string().min(1),
        amount,
        myReference: z.string().default(''),
        theirReference: z.string().default(''),
      }),
    )
    .min(1, 'must contain at least one payment')
    .max(MAX_BATCH, `must contain at most ${MAX_BATCH} payments`),
})

export const topUpBody = z
  .object({
    amount,
    description: z.string().min(1).optional(),
  })
  .strict()

export const createTransactionBody = z
  .object({
    type: z.enum(['DEBIT', 'CREDIT']).optional(),
    transactionType: z.string().min(1).optional(),
    status: z.enum(['POSTED', 'PENDING']).optional(),
    description: z.string().optional(),
    cardNumber: z.string().optional(),
    postingDate: date.optional(),
    valueDate: date.optional(),
    actionDate: date.optional(),
    transactionDate: date.optional(),
    amount: amount.optional(),
  })
  .strict()
  .openapi({ description: 'Fields left out get random values.' })

export const allowNonCardPendingQuery = z.object({
  allowNonCardPending: booleanString.optional().openapi({
    description: 'Allow a non-card transaction to be created as PENDING.',
  }),
})

export const createAccountBody = z
  .object({
    accountId: z.string().min(1).optional(),
    accountNumber: z.string().min(1).optional(),
    accountName: z.string().min(1).optional(),
    referenceName: z.string().min(1).optional(),
    productName: z.string().min(1).optional(),
    kycCompliant: z.boolean().optional(),
    profileId: z.string().min(1).optional(),
    profileName: z.string().min(1).optional(),
    overdraftLimit: z.number().nonnegative().optional().openapi({ description: 'How far below zero the account may go.' }),
  })
  .strict()
  .openapi({ description: 'Fields left out get random values; the account joins the first profile.' })

export const createBeneficiaryBody = z
  .object({
    beneficiaryId: z.string().min(1).optional(),
    accountNumber: z.string().optional(),
    code: z.string().optional(),
    bank: z.string().optional(),
    beneficiaryName: z.string().optional(),
    lastPaymentAmount: z.string().optional(),
    lastPaymentDate: z.string().optional(),
    cellNo: z.string().nullable().optional(),
    emailAddress: z.string().nullable().optional(),
    name: z.string().optional(),
    referenceAccountNumber: z.string().optional(),
    referenceName: z.string().optional(),
    categoryId: z.string().optional(),
    profileId: z.string().optional(),
  })
  .strict()
  .openapi({ description: 'Fields left out get random values.' })

// --- Cards ------------------------------------------------------------------

export const createCardBody = z
  .object({
    cardKey: z.string().optional(),
    cardNumber: z.string().min(1).optional(),
    isProgrammable: z.boolean().optional(),
    status: z.string().min(1).optional(),
    cardTypeCode: z.string().min(1).optional(),
    accountId: z.string().min(1).optional(),
    accountNumber: z.string().min(1).optional(),
  })
  .strict()

export const cardCodeBody = z.object({
  code: z.string().default(''),
})

export const toggleProgrammableBody = z.object({
  Enabled: z.boolean().default(false),
})

export const environmentVariablesBody = z.object({
  variables: z.record(z.unknown()).default({}),
})

const pointOfSale = {
  currencyCode: z.string().regex(/^[A-Za-z]{3}$/, 'must be a 3-letter currency code').openapi({ example: 'ZAR' }),
  centsAmount: z.coerce.number().int().positive('must be greater than zero').openapi({ example: 1000 }),
  merchantCode: z.string().regex(/^\d{4}$/, 'must be a 4-digit merchant category code').openapi({ example: '5411' }),
  merchantName: z.string().min(1).openapi({ example: 'Corner Cafe' }),
  merchantCity: z.string().min(1).openapi({ example: 'Cape Town' }),
  countryCode: z.string().regex(/^[A-Za-z]{2}$/, 'must be a 2-letter country code').openapi({ example: 'ZA' }),
}

export const executeCodeBody = z.object({
  ...pointOfSale,
  simulationcode: z.string().default('').openapi({ description: 'The card code to run.' }),
})

export const executeLiveBody = z.object({
  ...pointOfSale,
  settle: z.boolean().default(false).openapi({ description: 'Post the purchase immediately instead of placing a pending hold.' }),
})

export const cardStatusBody = z.object({
  status: z
    .string()
    .transform(value => value.toLowerCase())
    .pipe(z.enum(['active', 'stopped'], { message: 'must be Active or Stopped' }))
    .transform(value => (value === 'active' ? 'Active' : 'Stopped'))
    .openapi({ type: 'string', enum: ['Active', 'Stopped'] }),
})

// --- Exchange rates ---------------------------------------------------------

export const currencyCodeParams = z.object({
  currencyCode: z
    .string()
    .regex(/^[A-Za-z]{3}$/, 'must be a 3-letter currency code')
    .transform(code => code.toUpperCase())
    .openapi({ example: 'USD' }),
})

export const exchangeRateBody = z.object({
  zarPerUnit: z.coerce
    .number()
    .positive('must be greater than zero')
    .finite()
    .openapi({ description: 'How many rand one unit of the currency buys.', example: 17.6 }),
})

// --- Webhooks ---------------------------------------------------------------

const webhookUrl = z
  .string()
  .url('must be a URL')
  .refine(value => /^https?:\/\//i.test(value), 'must be an http or https URL')
  .openapi({ example: 'http://localhost:8080/webhooks/sandbox' })

const webhookEvents = z
  .array(z.enum(WEBHOOK_EVENTS))
  .min(1, 'must name at least one event')
  .openapi({ description: 'Events to receive. Omit for every event.' })

export const createWebhookBody = z
  .object({
    url: webhookUrl,
    events: webhookEvents.optional(),
    secret: z
      .string()
      .min(8, 'must be at least 8 characters')
      .optional()
      .openapi({ description: 'Signs each delivery: X-Sandbox-Signature: sha256=<HMAC of the body>.' }),
  })
  .strict()

export const updateWebhookBody = z
  .object({
    url: webhookUrl.optional(),
    events: webhookEvents.optional(),
    active: z.boolean().optional().openapi({ description: 'Pause (false) or resume (true) deliveries.' }),
  })
  .strict()

export const webhookIdParams = z.object({ webhookId: z.string().min(1) })

export const deliveriesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// --- Fault injection --------------------------------------------------------

const percent = z.number().min(0, 'must be 0–100').max(100, 'must be 0–100')

export const faultConfigBody = z
  .object({
    errorRate: percent.default(0).openapi({ description: 'Percent of requests answered with errorStatus.', example: 20 }),
    errorStatus: z
      .union([z.literal(429), z.literal(500), z.literal(502), z.literal(503), z.literal(504)])
      .default(503)
      .openapi({ type: 'integer', enum: [429, 500, 502, 503, 504] }),
    timeoutRate: percent.default(0).openapi({ description: 'Percent of requests held, then dropped.' }),
    latencyMs: z
      .number()
      .int()
      .min(0)
      .max(60_000, 'must be at most 60000')
      .default(0)
      .openapi({ description: 'Added to every matching request.', example: 500 }),
    pathPrefix: z
      .string()
      .refine(value => value === '' || value.startsWith('/'), "must be '' or start with /")
      .default('')
      .openapi({ description: "Only requests under this path, e.g. /za/v1/cards. '' for all.", example: '' }),
  })
  .strict()
  .openapi({ description: 'Fields left out are off (0, or 503 and all paths).' })

// --- Sandbox and identity ---------------------------------------------------

export const settingsBody = z.object({
  client_id: z.string(),
  client_secret: z.string(),
  api_key: z.string(),
  token_expiry: z.coerce.number().int().positive(),
  auth: z.union([z.boolean(), booleanString]),
})

export const loginBody = z.object({
  email: z.string().default(''),
  password: z.string().default(''),
  qsp: z.string().optional(),
})
