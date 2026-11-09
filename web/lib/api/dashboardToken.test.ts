import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAPI } from './common';
import { forgetToken } from './dashboardToken';

// With auth on, the dashboard gets a client-credentials token and retries.
afterEach(() => {
  vi.unstubAllGlobals();
  forgetToken();
});

const ENVS = { data: { client_id: 'id', client_secret: 'secret', api_key: 'key', auth: true } };

function respond(status: number, body: unknown = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
}

describe('dashboard token', () => {
  it('gets a token after a 401 and retries the request with it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(401, ''))
      .mockResolvedValueOnce(respond(200, ENVS))
      .mockResolvedValueOnce(respond(200, { access_token: 'tok-1', expires_in: 1799 }))
      .mockResolvedValueOnce(respond(200, { data: { accounts: [] } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAPI('/za/pb/v1/accounts')).resolves.toEqual({ data: { accounts: [] } });

    const [envsUrl] = fetchMock.mock.calls[1];
    expect(envsUrl).toBe('http://localhost:3000/envs');
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[2];
    expect(tokenUrl).toBe('http://localhost:3000/identity/v2/oauth2/token');
    expect(tokenInit.headers).toMatchObject({ Authorization: `Basic ${btoa('id:secret')}`, 'x-api-key': 'key' });
    expect(tokenInit.body).toBe('grant_type=client_credentials');
    const [, retryInit] = fetchMock.mock.calls[3];
    expect(retryInit.headers).toMatchObject({ Authorization: 'Bearer tok-1' });
  });

  it('reuses the token until it expires', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(401, ''))
      .mockResolvedValueOnce(respond(200, ENVS))
      .mockResolvedValueOnce(respond(200, { access_token: 'tok-2', expires_in: 1799 }))
      // A fresh Response each time: a body can only be read once.
      .mockImplementation(async () => respond(200, { data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchAPI('/za/pb/v1/accounts');
    await fetchAPI('/za/v1/cards');
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[4][1].headers).toMatchObject({ Authorization: 'Bearer tok-2' });
  });

  it('never asks for a token outside /za', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => respond(401, ''));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAPI('/envs')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after one retry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(401, ''))
      .mockResolvedValueOnce(respond(200, ENVS))
      .mockResolvedValueOnce(respond(200, { access_token: 'tok-3', expires_in: 1799 }))
      .mockResolvedValueOnce(respond(401, ''));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAPI('/za/pb/v1/accounts')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
