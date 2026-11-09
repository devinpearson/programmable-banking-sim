/**
 * The dashboard's own access token, for when the sandbox has authentication
 * turned on. It goes through the real client-credentials flow with the
 * sandbox's configured credentials (GET /envs), rather than any bypass.
 */

interface Credentials {
  client_id: string;
  client_secret: string;
  api_key: string;
}

interface CachedToken {
  accessToken: string;
  // Epoch ms; refreshed a little early.
  expiresAt: number;
}

const EARLY_REFRESH_MS = 30_000;

let cached: CachedToken | null = null;
let pending: Promise<string> | null = null;

export function currentToken(now = Date.now()): string | null {
  return cached && now < cached.expiresAt ? cached.accessToken : null;
}

export function forgetToken() {
  cached = null;
}

async function requestToken(baseUrl: string): Promise<string> {
  const envs = await fetch(`${baseUrl}/envs`, { cache: 'no-store' });
  if (!envs.ok) throw new Error(`Could not read the sandbox settings (${envs.status})`);
  const { data } = (await envs.json()) as { data: Credentials };

  const response = await fetch(`${baseUrl}/identity/v2/oauth2/token`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Basic ${btoa(`${data.client_id}:${data.client_secret}`)}`,
      'x-api-key': data.api_key,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Sandbox-Client': 'dashboard',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new Error(`The sandbox refused the dashboard's token request (${response.status})`);
  const token = (await response.json()) as { access_token: string; expires_in: number };
  cached = {
    accessToken: token.access_token,
    expiresAt: Date.now() + Math.max(token.expires_in * 1000 - EARLY_REFRESH_MS, 0),
  };
  return token.access_token;
}

// A fresh token; concurrent callers share one request.
export function obtainToken(baseUrl: string): Promise<string> {
  if (!pending) {
    pending = requestToken(baseUrl).finally(() => {
      pending = null;
    });
  }
  return pending;
}
