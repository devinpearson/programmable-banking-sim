import { expect, test } from '@playwright/test';
import { openForm, showTab } from './dashboard';
import { API_URL } from './servers';

test.afterEach(async ({ request }) => {
  // The clock is saved in the sandbox; put it back for other tests.
  await request.post(`${API_URL}/clock/reset`);
  await request.get(`${API_URL}/restore`);
});

test('jump a month ahead: salary and debit orders post, then back to today', async ({ page, request }) => {
  expect((await request.post(`${API_URL}/scenarios/hackathon`)).ok()).toBe(true);
  await page.goto('/#simulate');
  const time = page.getByRole('region', { name: 'Time and recurring transactions' });
  await expect(time.getByRole('row', { name: /Salary/ })).toContainText('Monthly on the 25th');
  await expect(time.getByRole('row', { name: /Gym membership/ })).toBeVisible();

  await time.getByRole('button', { name: '+1 month' }).click();
  await expect(page.getByText(/^Moved to \d{4}-\d{2}-\d{2}: \d+ transactions posted/)).toBeVisible();
  const banner = page.getByRole('status').filter({ hasText: 'Sandbox date:' });
  await expect(banner).toContainText('days ahead of today');

  // The salary shows in the cheque account's history.
  await showTab(page, 'Banking');
  const history = page.getByRole('region', { name: 'Transactions', exact: true });
  await history.getByLabel('Account').selectOption({ label: 'Cheque Account (20000000021)' });
  await expect(history.getByRole('row', { name: /Salary/ }).first()).toContainText(/\+R 25[\s,]?000[.,]00/);

  await banner.getByRole('button', { name: 'Back to today' }).click();
  await expect(banner).toHaveCount(0);
});

test('add a weekly recurring transaction', async ({ page }) => {
  await page.goto('/#simulate');
  const time = page.getByRole('region', { name: 'Time and recurring transactions' });
  await openForm(time, 'Add a recurring transaction');
  await time.getByLabel('Account', { exact: true }).selectOption({ label: 'Mr J Soap (10012420004)' });
  await time.getByLabel('Description').fill('Pocket money');
  await time.getByLabel('Kind').selectOption('CREDIT');
  await time.getByLabel('Amount (R)').fill('100');
  await time.getByLabel('Repeats').selectOption('weekly');
  await time.getByLabel('Weekday').selectOption('Monday');
  await time.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(/^Pocket money: first run on \d{4}-\d{2}-\d{2}$/)).toBeVisible();
  await expect(time.getByRole('row', { name: /Pocket money/ })).toContainText('Weekly on Monday');
});
