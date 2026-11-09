import type { Response } from 'express'
import type { AccessToken } from './types.js'

// Scopes a 3-legged (authorization_code) token can be granted, and the API
// routes each one unlocks. These mirror the permissions on Investec's consent
// screen (account details, balances, transactions, transfers, beneficiary
// payments, statements, card code); the exact scope strings the real API
// uses are not confirmed, so they live in this one table.
//
// client_credentials tokens (your own account) are not scope-limited.
export const SCOPES = [
  'accounts',
  'balances',
  'transactions',
  'transfers',
  'beneficiarypayments',
  'statements',
  'cards',
] as const

type Scope = (typeof SCOPES)[number]

// What each scope lets the user see or do, shown on the consent page.
export const SCOPE_DESCRIPTIONS: Record<Scope, string> = {
  accounts: 'Your account names and numbers',
  balances: 'Your account balances',
  transactions: 'Your transaction history',
  transfers: 'Transfer money between your accounts',
  beneficiarypayments: 'See your beneficiaries and pay them',
  statements: 'Your statements and documents',
  cards: 'Your cards and their programmable code',
}

// [method or '*', path pattern, scope]. Paths are the full request path
// without the query string. Routes not listed need no particular scope.
const SCOPE_RULES: [string, RegExp, Scope][] = [
  ['GET', /^\/za\/pb\/v1\/accounts\/?$/, 'accounts'],
  ['GET', /^\/za\/pb\/v1\/accounts\/[^/]+\/balance$/, 'balances'],
  ['GET', /^\/za\/pb\/v1\/accounts\/[^/]+\/(transactions|pending-transactions)$/, 'transactions'],
  ['POST', /^\/za\/pb\/v1\/accounts\/[^/]+\/transfermultiple$/, 'transfers'],
  ['POST', /^\/za\/pb\/v1\/accounts\/[^/]+\/paymultiple$/, 'beneficiarypayments'],
  ['GET', /^\/za\/pb\/v1\/accounts\/(beneficiaries|beneficiarycategories)$/, 'beneficiarypayments'],
  ['GET', /^\/za\/pb\/v1\/accounts\/[^/]+\/documents(\/.*)?$/, 'statements'],
  ['*', /^\/za\/v1\/cards(\/.*)?$/, 'cards'],
]

export function requiredScope(method: string, path: string): Scope | null {
  for (const [ruleMethod, pattern, scope] of SCOPE_RULES) {
    if ((ruleMethod === '*' || ruleMethod === method) && pattern.test(path)) {
      return scope
    }
  }
  return null
}

// Parse a space-separated scope request. No scope means every scope; any
// unknown scope makes the request invalid (returns null).
export function parseScopes(requested: unknown): string | null {
  const raw = typeof requested === 'string' ? requested.trim() : ''
  if (raw === '') {
    return SCOPES.join(' ')
  }
  const scopes = [...new Set(raw.split(/\s+/))]
  if (!scopes.every(scope => (SCOPES as readonly string[]).includes(scope))) {
    return null
  }
  return scopes.join(' ')
}

export function tokenHasScope(token: AccessToken, scope: string) {
  if (token.grant !== 'authorization_code') {
    return true
  }
  return token.scope.split(' ').includes(scope)
}

// The access token the /za middleware validated for this request, if any.
function requestToken(res: Response): AccessToken | undefined {
  return res.locals.token as AccessToken | undefined
}

// Whether the request's token may touch this account. Tokens without an
// account list (client_credentials, or auth turned off) may touch any.
export function accountAllowed(res: Response, accountId: string) {
  const accounts = requestToken(res)?.accounts
  return !accounts || accounts.includes(accountId)
}
