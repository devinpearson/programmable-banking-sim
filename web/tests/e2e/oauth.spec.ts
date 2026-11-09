import { expect, test } from '@playwright/test';
import { API_URL, CLIENT_ID } from './servers';

// The 3-legged OAuth flow through the web app's login and consent pages.
// The app's redirect_uri is the API's /health endpoint: any page will do.
function authorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${API_URL}/health`,
    scope: 'accounts transactions',
    state,
  });
  return `${API_URL}/identity/v2/oauth2/authorize?${params}`;
}

test('sign in, choose accounts and approve', async ({ page }) => {
  await page.goto(authorizeUrl('e2e-approve'));
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Authorize accounts' })).toBeVisible();
  await expect(page.getByText('Your account names and numbers')).toBeVisible();
  await expect(page.getByText('Your transaction history')).toBeVisible();
  await page.getByRole('checkbox', { name: /10012420003/ }).check();
  await page.getByRole('button', { name: 'Authorize' }).click();

  await page.waitForURL(/\/health\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('status')).toBe('SUCCESS');
  expect(url.searchParams.get('state')).toBe('e2e-approve');
  expect(url.searchParams.get('code')).toBeTruthy();
});

test('a wrong password shows an error and keeps the request', async ({ page }) => {
  await page.goto(authorizeUrl('e2e-retry'));
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Incorrect email or password.')).toBeVisible();

  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Authorize accounts' })).toBeVisible();
});

test('declining redirects back with DECLINED', async ({ page }) => {
  await page.goto(authorizeUrl('e2e-decline'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Decline' }).click();
  await page.waitForURL(/\/health\?/);
  expect(new URL(page.url()).searchParams.get('status')).toBe('DECLINED');
});

test('the consent page explains an expired request', async ({ page }) => {
  await page.goto('/consent?qsp=not-a-real-request');
  await expect(page.getByText(/expired or was not signed in/)).toBeVisible();
});
