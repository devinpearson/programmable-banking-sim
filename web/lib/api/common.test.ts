import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiUrl, errorMessageFrom, fetchAPI, fetchData } from './common';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(status: number, body: string) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('apiUrl', () => {
  it('joins the base URL and endpoint with one slash', () => {
    expect(apiUrl('/health')).toBe('http://localhost:3000/health');
    expect(apiUrl('health')).toBe('http://localhost:3000/health');
  });
});

describe('errorMessageFrom', () => {
  it("uses the sandbox's errorMessage", () => {
    expect(errorMessageFrom(422, JSON.stringify({ errorMessage: 'Insufficient funds' }))).toBe('Insufficient funds');
  });
  it('falls back to a message for the status', () => {
    expect(errorMessageFrom(404, '')).toBe('Not found');
    expect(errorMessageFrom(403, 'not json')).toBe('Not allowed for this token');
    expect(errorMessageFrom(418, '')).toBe('Request failed (418)');
  });
});

describe('fetchAPI', () => {
  it('returns the parsed JSON body', async () => {
    stubFetch(200, JSON.stringify({ ok: true }));
    await expect(fetchAPI('/x')).resolves.toEqual({ ok: true });
  });

  it('returns undefined for an empty success body', async () => {
    stubFetch(200, '');
    await expect(fetchAPI('/x')).resolves.toBeUndefined();
  });

  it('sends JSON bodies with a content type', async () => {
    const fetchMock = stubFetch(200, '{}');
    await fetchAPI('/x', { method: 'POST', body: '{"a":1}' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/x');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('throws an ApiError with the status and message', async () => {
    stubFetch(422, JSON.stringify({ errorMessage: 'Insufficient funds' }));
    const error = (await fetchAPI('/x').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Insufficient funds');
    expect(error.status).toBe(422);
  });
});

describe('fetchData', () => {
  it('unwraps the data envelope', async () => {
    stubFetch(200, JSON.stringify({ data: { accounts: [] }, links: {}, meta: {} }));
    await expect(fetchData('/x')).resolves.toEqual({ accounts: [] });
  });
});
