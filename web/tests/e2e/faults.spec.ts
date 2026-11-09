import { expect, test } from '@playwright/test';
import { showTab } from './dashboard';
import { API_URL } from './servers';

test.afterEach(async ({ request }) => {
  await request.delete(`${API_URL}/faults`);
});

test('faults break other clients but not the dashboard, and turn off from the banner', async ({ page, request }) => {
  expect((await request.get(`${API_URL}/restore`)).ok()).toBe(true);
  await page.goto('/#simulate');
  const panel = page.getByRole('region', { name: 'Fault injection' });

  await panel.getByLabel('Error rate (%)').fill('100');
  await panel.getByLabel('Error status').selectOption('503');
  await panel.getByLabel('Applies to').selectOption('/za/pb/v1/accounts');
  await panel.getByRole('button', { name: 'Save' }).click();

  const banner = page.getByRole('status').filter({ hasText: 'Fault injection is on' });
  await expect(banner).toContainText('100% of requests get 503 · on /za/pb/v1/accounts');

  // Your app (no dashboard header) gets the fault...
  const outside = await request.get(`${API_URL}/za/pb/v1/accounts`);
  expect(outside.status()).toBe(503);
  expect(outside.headers()['x-sandbox-fault-injected']).toBe('503');

  // ...while the dashboard keeps working.
  await showTab(page, 'Banking');
  await page.getByRole('region', { name: 'Accounts' }).getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('region', { name: 'Accounts' }).getByRole('row', { name: /10012420003/ })).toBeVisible();

  await banner.getByRole('button', { name: 'Turn off' }).click();
  await expect(banner).toHaveCount(0);
  expect((await request.get(`${API_URL}/za/pb/v1/accounts`)).status()).toBe(200);
});
