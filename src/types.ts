export enum TransactionType {
    DEBIT = 'DEBIT',
    CREDIT = 'CREDIT',
}

export interface AccessToken {
  expires_at: string
  scope: string
}

export interface AuthorizationCode {
  code: string
  expires_at: string
  scope: string
  redirect_uri: string
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

export interface Card {
    cardKey: string,
    cardNumber: string,
    isProgrammable: boolean,
    status: string,
    cardTypeCode: string,
    accountId: string,
    accountNumber: string,
    publishedCode: string,
    savedCode: string,
    envs: string
}

export enum SettingType {
    CLIENT_ID = 'client_id',
    CLIENT_SECRET = 'client_secret',
    API_KEY = 'api_key',
    TOKEN_EXPIRY = 'token_expiry',
    AUTH = 'auth',
}