import { expect, test } from '@playwright/test';
import { API_URL, CLIENT_ID, WEB_URL } from './servers';

// The OAuth tester page (/oauth): start the 3-legged flow, come back, exchange
// the code, refresh, and call the API with the token.
const MAIN = '10012420003';

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${API_URL}/restore`)).ok()).toBe(true);
});

test('runs the whole flow, and the token only reaches what was approved', async ({ page, request }) => {
  const { data: settings } = await (await request.get(`${API_URL}/envs`)).json();
  try {
    await page.goto('/oauth');
    await page.getByRole('button', { name: 'Turn on auth' }).click();
    await expect(page.getByRole('button', { name: 'Turn on auth' })).toBeHidden();

    // Ask for everything but cards.
    await page.getByRole('checkbox', { name: /^cards/ }).uncheck();
    await page.getByRole('button', { name: 'Start sign-in' }).click();

    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Authorize accounts' })).toBeVisible();
    await page.getByRole('checkbox', { name: new RegExp(MAIN) }).check();
    await page.getByRole('button', { name: 'Authorize' }).click();

    const back = page.getByRole('region', { name: '2. Back from the bank' });
    await expect(back.getByText('SUCCESS', { exact: true })).toBeVisible();
    await expect(back.getByText(/Matches the request/)).toBeVisible();
    await back.getByRole('button', { name: 'Exchange code for tokens' }).click();

    const tokens = page.getByRole('region', { name: '3. Tokens' });
    await expect(tokens.getByText('accounts balances transactions transfers beneficiarypayments statements')).toBeVisible();
    // The code is used up, so the URL drops it.
    await expect(page).toHaveURL(/\/oauth$/);

    const tryIt = page.getByRole('region', { name: '4. Call the API with the token' });
    await tryIt.getByRole('button', { name: 'Send' }).click();
    await expect(tryIt.getByText('Status 200')).toBeVisible();
    // Only the approved account.
    await expect(tryIt.locator('pre')).toContainText(MAIN);
    expect((await tryIt.locator('pre').textContent())?.match(/"accountNumber"/g)).toHaveLength(1);

    // No cards scope.
    await tryIt.getByRole('button', { name: '/za/v1/cards' }).click();
    await tryIt.getByRole('button', { name: 'Send' }).click();
    await expect(tryIt.getByText('Status 403')).toBeVisible();
    await expect(tryIt.locator('pre')).toContainText('Token is missing scope: cards');

    // Refreshing swaps both tokens.
    const before = await tokens.locator('code').first().textContent();
    await tokens.getByRole('button', { name: 'Refresh' }).click();
    await expect(tokens.locator('code').first()).not.toHaveText(before ?? '');
  } finally {
    await request.post(`${API_URL}/envs`, { data: { ...settings, auth: false } });
  }
});

test('a declined sign-in has nothing to exchange', async ({ page }) => {
  await page.goto('/oauth');
  await page.getByRole('button', { name: 'Start sign-in' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Decline' }).click();

  const back = page.getByRole('region', { name: '2. Back from the bank' });
  await expect(back.getByText('DECLINED', { exact: true })).toBeVisible();
  await expect(back.getByText(/can.t be exchanged/)).toBeVisible();
  await expect(back.getByRole('button', { name: 'Exchange code for tokens' })).toHaveCount(0);
});

test('finishes a flow started from Postman (no state) with the tester as the redirect', async ({ page }) => {
  // The request Investec's 3-legged Postman collection sends.
  const params = new URLSearchParams({
    scope: 'accounts transactions',
    client_id: CLIENT_ID,
    redirect_uri: `${WEB_URL}/oauth`,
    response_type: 'code',
  });
  await page.goto(`${API_URL}/identity/v2/oauth2/authorize?${params}`);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Authorize' }).click();

  const back = page.getByRole('region', { name: '2. Back from the bank' });
  await expect(back.getByText('SUCCESS', { exact: true })).toBeVisible();
  await expect(back.getByText(/None sent, so the flow was started elsewhere/)).toBeVisible();
  await back.getByRole('button', { name: 'Exchange code for tokens' }).click();
  await expect(page.getByRole('region', { name: '3. Tokens' }).getByText('accounts transactions', { exact: true })).toBeVisible();
});
