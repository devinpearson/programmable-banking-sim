import { describe, expect, it } from 'vitest';
import { authorizeUrl, parseCallback, randomState } from './oauth';

describe('authorizeUrl', () => {
  it('builds the authorize request with the ticked scopes', () => {
    const url = new URL(
      authorizeUrl({ clientId: 'abc', redirectUri: 'http://localhost:3001/oauth', scopes: ['accounts', 'cards'], state: 's1' }),
    );
    expect(url.pathname).toBe('/identity/v2/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe('abc');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3001/oauth');
    expect(url.searchParams.get('scope')).toBe('accounts cards');
    expect(url.searchParams.get('state')).toBe('s1');
  });

  it('leaves scope out when none are ticked', () => {
    const url = new URL(authorizeUrl({ clientId: 'abc', redirectUri: 'http://x', scopes: [], state: 's' }));
    expect(url.searchParams.has('scope')).toBe(false);
  });
});

describe('parseCallback', () => {
  const pending = { state: 's1', redirectUri: 'http://localhost:3001/oauth', scopes: [] };

  it('reads an approval and checks the state', () => {
    const params = new URLSearchParams({ status: 'SUCCESS', code: 'c1', authorizationCode: 'c1', state: 's1' });
    expect(parseCallback(params, pending)).toEqual({ status: 'SUCCESS', code: 'c1', state: 's1', stateMatches: true });
  });

  it('flags a state that does not match, or no started flow', () => {
    const params = new URLSearchParams({ status: 'DECLINED', code: 'c1', state: 'other' });
    expect(parseCallback(params, pending)?.stateMatches).toBe(false);
    expect(parseCallback(new URLSearchParams({ status: 'SUCCESS', code: 'c', state: 's1' }), null)?.stateMatches).toBe(false);
  });

  it('is null when the page was opened directly', () => {
    expect(parseCallback(new URLSearchParams(), pending)).toBeNull();
  });
});

it('makes a different random state each time', () => {
  expect(randomState()).toMatch(/^[0-9a-f]{24}$/);
  expect(randomState()).not.toBe(randomState());
});
