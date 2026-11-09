/**
 * The OAuth tester (app/oauth): plays the part of a third-party app going
 * through the sandbox's 3-legged (authorization_code) flow. It builds the
 * authorize URL, checks the redirect back, exchanges the code and refreshes
 * the tokens, all against the real endpoints.
 */

import { apiUrl, errorMessageFrom } from './api/common';

// The scopes /identity/v2/oauth2/authorize accepts (src/consent.ts).
export const OAUTH_SCOPES = [
  { scope: 'accounts', label: 'Account names and numbers' },
  { scope: 'balances', label: 'Balances' },
  { scope: 'transactions', label: 'Transaction history' },
  { scope: 'transfers', label: 'Transfers between accounts' },
  { scope: 'beneficiarypayments', label: 'Beneficiaries and payments' },
  { scope: 'statements', label: 'Statements and documents' },
  { scope: 'cards', label: 'Cards and card code' },
] as const;

export interface AuthorizeRequest {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}

export function authorizeUrl(request: AuthorizeRequest): string {
  const params = new URLSearchParams({
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    state: request.state,
  });
  // No scope at all would request every scope; send what was ticked.
  if (request.scopes.length > 0) params.set('scope', request.scopes.join(' '));
  return apiUrl(`/identity/v2/oauth2/authorize?${params}`);
}

export function randomState(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// The flow that was started, kept for the redirect back to this page.
export interface PendingFlow {
  state: string;
  redirectUri: string;
  scopes: string[];
}

const STORAGE_KEY = 'sandbox-oauth-tester';

export function savePendingFlow(flow: PendingFlow) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
  } catch {
    // Storage blocked: the state check will report the mismatch.
  }
}

export function loadPendingFlow(): PendingFlow | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingFlow) : null;
  } catch {
    return null;
  }
}

export interface CallbackResult {
  status: 'SUCCESS' | 'DECLINED' | string;
  code: string;
  state: string | null;
  // Whether state matches the flow this page started.
  stateMatches: boolean;
}

// What the sandbox appended to the redirect_uri, or null when this isn't a
// redirect back (no status or code).
export function parseCallback(params: URLSearchParams, pending: PendingFlow | null): CallbackResult | null {
  const status = params.get('status');
  const code = params.get('code') ?? params.get('authorizationCode');
  if (!status || !code) return null;
  const state = params.get('state');
  return { status, code, state, stateMatches: pending !== null && state === pending.state };
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

export interface ClientCredentials {
  client_id: string;
  client_secret: string;
}

async function tokenRequest(credentials: ClientCredentials, body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(apiUrl('/identity/v2/oauth2/token'), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Basic ${btoa(`${credentials.client_id}:${credentials.client_secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Sandbox-Client': 'dashboard',
    },
    body: new URLSearchParams(body).toString(),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status}: ${errorMessageFrom(response.status, text)}`);
  }
  return JSON.parse(text) as TokenResponse;
}

export function exchangeCode(credentials: ClientCredentials, code: string, redirectUri: string) {
  return tokenRequest(credentials, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
}

export function refreshAccessToken(credentials: ClientCredentials, refreshToken: string) {
  return tokenRequest(credentials, { grant_type: 'refresh_token', refresh_token: refreshToken });
}

export interface TryResult {
  status: number;
  body: string;
}

// Call the emulated API with the token the flow produced.
export async function callWithToken(path: string, accessToken: string): Promise<TryResult> {
  const response = await fetch(apiUrl(path), {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Sandbox-Client': 'dashboard' },
  });
  const text = await response.text();
  let body = text;
  try {
    body = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // Not JSON: show it as it came.
  }
  return { status: response.status, body };
}
