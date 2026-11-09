import { z } from './zod.js'

// Response shapes, for the OpenAPI document only (responses are not
// validated at runtime). Prisma decimals serialise as strings.

const decimal = z.string().openapi({ example: '125.50', description: 'Decimal amount' })
const isoDateTime = z.string().openapi({ example: '2026-11-09T10:00:00.000Z' })

// Most responses wrap their payload: { data, links: { self }, meta }.
export function envelope<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    data,
    links: z.object({ self: z.string().openapi({ example: 'http://localhost:3000/za/pb/v1/accounts' }) }),
    meta: z.object({ totalPages: z.number().int().openapi({ example: 1 }) }),
  })
}

export const ErrorResponse = z
  .object({
    errorMessage: z.string().openapi({ example: 'Insufficient funds' }),
    details: z
      .array(
        z.object({
          location: z.enum(['params', 'query', 'body']),
          path: z.string(),
          message: z.string(),
        }),
      )
      .optional()
      .openapi({ description: 'Every validation problem, for 400 responses.' }),
  })
  .openapi('Error', { description: 'Most errors explain themselves; some (e.g. a plain 404) have an empty body.' })

// --- Accounts ---------------------------------------------------------------

export const Account = z
  .object({
    accountId: z.string().openapi({ example: '4675778129910189600000003' }),
    accountNumber: z.string().openapi({ example: '10012420003' }),
    accountName: z.string().openapi({ example: 'Mr J Soap' }),
    referenceName: z.string(),
    productName: z.string().openapi({ example: 'Private Bank Account' }),
    kycCompliant: z.boolean(),
    profileId: z.string(),
    profileName: z.string(),
  })
  .openapi('Account')

export const Balance = z
  .object({
    accountId: z.string(),
    currentBalance: z.number().openapi({ description: 'Posted transactions only.', example: -35696.04 }),
    availableBalance: z.number().openapi({
      description: 'Current balance plus the overdraft limit, less pending card holds.',
      example: 14303.96,
    }),
    currency: z.string().openapi({ example: 'ZAR' }),
  })
  .openapi('Balance')

export const Transaction = z
  .object({
    accountId: z.string(),
    type: z.enum(['DEBIT', 'CREDIT']),
    transactionType: z.string().openapi({ example: 'CardPurchases' }),
    status: z.enum(['POSTED', 'PENDING']),
    description: z.string(),
    cardNumber: z.string(),
    postedOrder: z.union([decimal, z.number()]).openapi({ description: '0 for pending transactions.' }),
    postingDate: z.string().openapi({ description: 'Empty until a pending transaction settles.' }),
    valueDate: z.string(),
    actionDate: z.string(),
    transactionDate: z.string(),
    amount: decimal,
    runningBalance: z.union([decimal, z.number()]).openapi({ description: '0 for pending transactions.' }),
  })
  .openapi('Transaction')

// A transaction as stored (create/settle/top-up responses), with its id.
export const StoredTransaction = Transaction.extend({
  transactionId: z.number().int(),
}).openapi('StoredTransaction')

export const PendingTransaction = z
  .object({
    transactionId: z.number().int().openapi({ description: 'Sandbox addition, for settling or reversing the hold.' }),
    accountId: z.string(),
    type: z.enum(['DEBIT', 'CREDIT']),
    transactionType: z.string(),
    status: z.literal('PENDING'),
    description: z.string(),
    cardNumber: z.string(),
    transactionDate: z.string(),
    amount: decimal,
  })
  .openapi('PendingTransaction')

export const Beneficiary = z
  .object({
    beneficiaryId: z.string(),
    accountNumber: z.string(),
    code: z.string(),
    bank: z.string(),
    beneficiaryName: z.string(),
    lastPaymentAmount: z.string().openapi({ example: '2,000.00' }),
    lastPaymentDate: z.string().openapi({ example: '25/04/2023' }),
    cellNo: z.string().nullable(),
    emailAddress: z.string().nullable(),
    name: z.string(),
    referenceAccountNumber: z.string(),
    referenceName: z.string(),
    categoryId: z.string(),
    profileId: z.string(),
  })
  .openapi('Beneficiary')

export const BeneficiaryCategory = z
  .object({ categoryId: z.string(), isDefault: z.boolean(), name: z.string() })
  .openapi('BeneficiaryCategory')

export const DocumentSummary = z
  .object({ documentType: z.string(), documentDate: z.string(), description: z.string() })
  .openapi('DocumentSummary')

export const DocumentDetail = z
  .object({
    accountId: z.string(),
    documentType: z.string(),
    documentDate: z.string(),
    fileName: z.string(),
    mimeType: z.string(),
    note: z.string(),
  })
  .openapi('DocumentDetail')

// Investec's transfermultiple/paymultiple response (PascalCase, as theirs).
export const TransferResponses = z
  .object({
    TransferResponses: z.array(
      z.object({
        PaymentReferenceNumber: z.string().openapi({ example: 'UBP2201761367' }),
        PaymentDate: z.string().openapi({ example: '09/11/2026' }),
        Status: z.string().openapi({ example: '- No authorisation necessary <BR> - Payment/Transfer effective date 09/11/2026' }),
        BeneficiaryName: z.string(),
        BeneficiaryAccountId: z.string().openapi({ description: 'The destination account id (transfers) or beneficiary id (payments).' }),
        AuthorisationRequired: z.boolean(),
      }),
    ),
    ErrorMessage: z.string().nullable(),
  })
  .openapi('TransferResponses')

export const Profile = z
  .object({
    profileId: z.string(),
    profileName: z.string(),
    default: z.boolean().openapi({ description: 'The sandbox treats the first profile as the default.' }),
  })
  .openapi('Profile')

// --- Cards ------------------------------------------------------------------

export const Card = z
  .object({
    CardKey: z.string().openapi({ example: '700615' }),
    CardNumber: z.string().openapi({ example: '402167XXXXXX1111' }),
    IsProgrammable: z.boolean(),
    status: z.string().openapi({ example: 'Active' }),
    CardTypeCode: z.string(),
    AccountNumber: z.string(),
    AccountId: z.string(),
  })
  .openapi('Card')

export const CreatedCard = z
  .object({
    cardKey: z.string(),
    cardNumber: z.string(),
    isProgrammable: z.boolean(),
    status: z.string(),
    cardTypeCode: z.string(),
    accountId: z.string(),
    accountNumber: z.string(),
    publishedCode: z.string(),
    savedCode: z.string(),
    envs: z.string(),
  })
  .openapi('CreatedCard')

export const CardCode = z
  .object({
    cardCode: z.object({
      codeId: z.string(),
      code: z.string(),
      createdAt: isoDateTime,
      updatedAt: isoDateTime,
      publishedAt: isoDateTime.nullable(),
    }),
  })
  .openapi('CardCode')

export const EnvironmentVariables = z
  .object({
    result: z.object({
      variables: z.record(z.unknown()),
      createdAt: isoDateTime,
      updatedAt: isoDateTime,
      error: z.null(),
    }),
  })
  .openapi('EnvironmentVariables')

const ExecutionLog = z.object({
  logId: z.string().optional(),
  executionId: z.string().optional(),
  createdAt: isoDateTime,
  level: z.string(),
  content: z.string(),
})

export const Execution = z
  .object({
    executionId: z.string(),
    cardKey: z.string().optional(),
    rootCodeFunctionId: z.string(),
    sandbox: z.boolean(),
    type: z.enum(['before_transaction', 'after_transaction', 'after_decline']),
    authorizationApproved: z.boolean().nullable(),
    smsCount: z.number().int(),
    emailCount: z.number().int(),
    pushNotificationCount: z.number().int(),
    createdAt: isoDateTime,
    startedAt: isoDateTime,
    completedAt: isoDateTime,
    updatedAt: isoDateTime.nullable(),
    logs: z.array(ExecutionLog),
  })
  .openapi('Execution')

const Exchange = z
  .object({
    currencyCode: z.string().openapi({ example: 'USD' }),
    amount: z.number().openapi({ description: 'In the purchase currency.', example: 12.5 }),
    zarPerUnit: z.number().openapi({ example: 17.6 }),
    zarAmount: z.number().openapi({ description: 'What the account is charged, in rand.', example: 220 }),
  })
  .openapi('Exchange')

export const Webhook = z
  .object({
    webhookId: z.string(),
    url: z.string(),
    events: z.array(z.string()).openapi({ example: ['transaction.posted', 'card.authorization'] }),
    hasSecret: z.boolean().openapi({ description: 'Whether deliveries are signed. The secret itself is never returned.' }),
    active: z.boolean(),
    createdAt: isoDateTime,
  })
  .openapi('Webhook')

// The JSON body of every webhook delivery.
export function webhookEnvelope<T extends z.ZodTypeAny>(event: string, data: T) {
  return z.object({
    id: z.string().openapi({ description: 'The event id: the same on every retry (also in X-Sandbox-Delivery).' }),
    event: z.literal(event),
    createdAt: isoDateTime,
    data,
  })
}

export const WebhookDelivery = z
  .object({
    deliveryId: z.string().openapi({ description: 'This attempt.' }),
    webhookId: z.string(),
    eventId: z.string().openapi({ description: 'The event: the same for every attempt (payload id, X-Sandbox-Delivery).' }),
    attempt: z.number().int().openapi({ description: '1 for the first try; retries after 5 s, 30 s and 2 min by default.' }),
    event: z.string(),
    status: z.enum(['delivered', 'failed']),
    responseStatus: z.number().int().nullable(),
    error: z.string().nullable().openapi({ example: 'Connection refused' }),
    durationMs: z.number().int(),
    createdAt: isoDateTime,
    payload: z.object({ id: z.string(), event: z.string(), createdAt: isoDateTime, data: z.unknown() }),
  })
  .openapi('WebhookDelivery')

export const CardAuthorizationEvent = z
  .object({
    cardKey: z.string(),
    cardNumber: z.string(),
    accountId: z.string(),
    approved: z.boolean(),
    reason: z.enum(['insufficient_funds', 'card_not_active', 'declined_by_card_code']).nullable(),
    merchant: z.object({ name: z.string(), city: z.string(), countryCode: z.string(), categoryCode: z.string() }),
    currencyCode: z.string(),
    centsAmount: z.number().int().openapi({ description: 'In the purchase currency.' }),
    zarAmount: z.number().openapi({ description: 'What the account is charged, in rand.' }),
    exchange: z.union([Exchange, z.null()]),
    transactionId: z.number().int().nullable().openapi({ description: 'The hold or posted purchase, when approved.' }),
  })
  .openapi('CardAuthorizationEvent')

export const FaultConfig = z
  .object({
    errorRate: z.number(),
    errorStatus: z.number().int().openapi({ enum: [429, 500, 502, 503, 504] }),
    timeoutRate: z.number(),
    latencyMs: z.number().int(),
    pathPrefix: z.string(),
    active: z.boolean().openapi({ description: 'Whether any fault is on.' }),
  })
  .openapi('FaultConfig')

export const ExchangeRate = z
  .object({
    currencyCode: z.string().openapi({ example: 'USD' }),
    zarPerUnit: z.number().openapi({ example: 17.6 }),
    updatedAt: isoDateTime,
  })
  .openapi('ExchangeRate')

export const SwipeResult = z
  .object({
    result: z.boolean().openapi({ description: 'Whether the purchase was approved.' }),
    reason: z.enum(['insufficient_funds', 'card_not_active']).optional().openapi({
      description: 'Why the bank declined it, before any card code ran.',
    }),
    // A plain union with null: .nullable() (or describing the field) on this
    // extended, registered schema makes the generator re-expand it in allOf.
    transaction: z.union([StoredTransaction, z.null()]),
    // The conversion for a foreign purchase; null for rand.
    exchange: z.union([Exchange, z.null()]),
  })
  .openapi('SwipeResult', {
    description:
      "transaction is the pending hold (or posted purchase) on the card's account; null when declined or the card has no account.",
  })

const ReferenceItem = z.object({ code: z.string(), name: z.string() })
export const ReferenceList = z.object({ result: z.array(ReferenceItem) }).openapi('ReferenceList')

// --- Sandbox and identity ---------------------------------------------------

export const Scenario = z
  .object({ id: z.string().openapi({ example: 'hackathon' }), name: z.string(), description: z.string() })
  .openapi('Scenario')

export const ScenarioLoaded = z
  .object({ id: z.string(), name: z.string(), accounts: z.number().int(), beneficiaries: z.number().int(), cards: z.number().int() })
  .openapi('ScenarioLoaded')

export const DatabaseSummary = z
  .object({ profiles: z.number().int(), accounts: z.number().int(), cards: z.number().int(), transactions: z.number().int() })
  .openapi('DatabaseSummary')

export const Settings = z
  .object({
    client_id: z.string(),
    client_secret: z.string(),
    api_key: z.string(),
    token_expiry: z.number().int().openapi({ description: 'Seconds' }),
    auth: z.boolean().openapi({ description: 'Whether /za routes require a bearer token.' }),
  })
  .openapi('Settings')

export const TokenResponse = z
  .object({
    access_token: z.string(),
    token_type: z.literal('Bearer'),
    expires_in: z.number().int(),
    scope: z.string().openapi({ example: 'accounts balances transactions' }),
    refresh_token: z.string().optional().openapi({ description: 'For authorization_code and refresh_token grants.' }),
  })
  .openapi('TokenResponse')

export const ConsentDetails = z
  .object({
    scopes: z.array(z.object({ scope: z.string(), description: z.string() })),
    accounts: z.array(
      z.object({ accountId: z.string(), accountNumber: z.string(), accountName: z.string(), productName: z.string() }),
    ),
  })
  .openapi('ConsentDetails')
