export enum TransactionType {
    DEBIT = 'DEBIT',
    CREDIT = 'CREDIT',
}

export enum TransactionStatus {
    POSTED = 'POSTED',
    PENDING = 'PENDING',
}

// Real-API transactionType values the sandbox writes itself, so filtering by
// type matches the seeds and faker data (which also use DebitOrders,
// FasterPay and FeesAndInterest).
export enum InvestecTransactionType {
    CardPurchases = 'CardPurchases',
    CardWithdrawals = 'CardWithdrawals',
    Deposits = 'Deposits',
    OnlineBankingPayments = 'OnlineBankingPayments',
    OnlineBankingTransfers = 'OnlineBankingTransfers',
}

// Only card transactions sit in PENDING (an authorisation hold) before they
// settle; payments, transfers, debit orders and fees post straight away.
export const CARD_TRANSACTION_TYPES: string[] = [
  InvestecTransactionType.CardPurchases,
  InvestecTransactionType.CardWithdrawals,
]

export interface AccessToken {
  expires_at: string
  // Space-separated scopes. Only enforced for authorization_code tokens.
  scope: string
  grant: 'client_credentials' | 'authorization_code'
  // Account ids the user consented to; null means every account.
  accounts: string[] | null
}

export interface AuthorizationCode {
  code: string
  expires_at: string
  scope: string
  redirect_uri: string
  // Opaque client value echoed back on the redirect (CSRF protection).
  state?: string
  // Set on approval from the accounts the user selected.
  accounts: string[] | null
}

// What a refresh token re-issues: the same scope and accounts as the
// original grant.
export interface RefreshGrant {
  scope: string
  accounts: string[] | null
}

export type BalanceResponse = {
    accountId: string,
    currentBalance: number,
    availableBalance: number,
    currency: string,
}

export interface Settings {
  client_id: string
  client_secret: string
  api_key: string
  token_expiry: number
  auth: boolean
}

export interface ControlMessage {
  action: string
  message: string
}

export type ExecutionItem = {
  executionId: string
  cardKey: string
  rootCodeFunctionId: string
  sandbox: boolean
  type: string
  authorizationApproved: boolean | null
  smsCount: number
  emailCount: number
  pushNotificationCount: number
  createdAt: Date
  startedAt: Date
  completedAt: Date
  updatedAt: Date | null
  logs: Array<unknown> | null // Add the 'logs' property
}
