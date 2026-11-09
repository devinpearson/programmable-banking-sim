import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { API_URL } from './servers';

const MAIN = '10012420003';

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${API_URL}/restore`)).ok()).toBe(true);
});

test('the dashboard keeps working with authentication on', async ({ page, request }) => {
  const { data: settings } = await (await request.get(`${API_URL}/envs`)).json();
  await request.post(`${API_URL}/envs`, { data: { ...settings, auth: true } });
  try {
    // Without a token the API now refuses...
    expect((await request.get(`${API_URL}/za/pb/v1/accounts`)).status()).toBe(401);
    // ...but the dashboard gets its own and shows the accounts.
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Accounts' }).getByRole('row', { name: new RegExp(MAIN) })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Cards' }).getByRole('row', { name: /402167XXXXXX1111/ })).toBeVisible();
  } finally {
    await request.post(`${API_URL}/envs`, { data: { ...settings, auth: false } });
  }
});

test('a currency added in the rates editor can be used for a swipe', async ({ page }) => {
  await page.goto('/');
  const rates = page.getByRole('region', { name: 'Exchange rates' });
  await rates.getByLabel('Currency code').fill('thb');
  await rates.getByLabel('Rand per unit').fill('0.5');
  await rates.getByRole('button', { name: 'Add currency' }).click();
  await expect(page.getByText('Added THB at R 0.5')).toBeVisible();
  await expect(rates.getByRole('row', { name: /THB/ })).toBeVisible();

  await expect(page.getByRole('region', { name: 'Cards' }).getByLabel('Currency').locator('option', { hasText: 'THB' })).toHaveCount(1);
});

test('export the sandbox, change it, and import the file back', async ({ page }) => {
  await page.goto('/');
  const accounts = page.getByRole('region', { name: 'Accounts' });
  await expect(accounts.getByRole('row', { name: new RegExp(MAIN) })).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^sandbox-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const exported = JSON.parse(await readFile(file, 'utf-8'));
  expect(exported.version).toBe(1);

  // Clear everything, then import the file.
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear data' }).click();
  await expect(accounts.getByText(/No accounts yet/)).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('Import a sandbox file').setInputFiles(file);
  await expect(page.getByText(/^Imported .+: 5 accounts, 13 transactions, 1 cards$/)).toBeVisible();
  await expect(accounts.getByRole('row', { name: new RegExp(MAIN) })).toBeVisible();
});
