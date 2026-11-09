/**
 * Shared API client: fetch wrapper, base URL, and ApiError.
 * Used by the domain modules under lib/api.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// The sandbox API allows any origin via CORS, so the browser calls it directly.
export function getApiBaseUrl(): string {
  return API_BASE_URL.replace(/\/$/, '');
}

export function apiUrl(endpoint: string): string {
  return getApiBaseUrl() + (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// The sandbox explains some errors as { "errorMessage": "..." } (e.g.
// "Insufficient funds"); most send an empty body.
export function errorMessageFrom(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { errorMessage?: unknown };
    if (typeof parsed.errorMessage === 'string' && parsed.errorMessage) {
      return parsed.errorMessage;
    }
  } catch {
    // Empty or non-JSON body.
  }
  const fallbacks: Record<number, string> = {
    400: 'The request was not valid',
    401: 'Authentication required',
    403: 'Not allowed for this token',
    404: 'Not found',
    409: 'Already exists',
    422: 'The request could not be processed',
  };
  return fallbacks[status] ?? `Request failed (${status})`;
}

export async function fetchAPI<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(endpoint), {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      // Exempts the dashboard from random fault injection (PUT /faults).
      'X-Sandbox-Client': 'dashboard',
      ...init?.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new ApiError(errorMessageFrom(response.status, text), response.status, text);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

// Most sandbox responses wrap their payload as { data, links, meta }.
export async function fetchData<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const body = await fetchAPI<{ data: T }>(endpoint, init);
  return body.data;
}

export function postJSON(body: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(body) };
}
