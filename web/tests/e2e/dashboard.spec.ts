import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './servers';

// Seeded data (prisma/*.ts): the Private Bank Account 10012420003 has a
// R50,000 overdraft and card 402167XXXXXX1111; PrimeSaver 10012420004 has no
// overdraft.
const MAIN = '10012420003';
const SAVER = '10012420004';
const CARD = '402167XXXXXX1111';

test.beforeEach(async ({ request, page }) => {
  // Every test starts from the seed data.
  expect((await request.get(`${API_URL}/restore`)).ok()).toBe(true);
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Accounts' }).getByRole('row', { name: new RegExp(MAIN) })).toBeVisible();
});

async function swipe(
  page: Page,
  merchant: string,
  amount: string,
  options: { settle?: boolean; currency?: string; card?: string } = {},
) {
  const cards = page.getByRole('region', { name: 'Cards' });
  const currency = options.currency ?? 'ZAR';
  await cards.getByLabel('Card', { exact: true }).selectOption({ label: options.card ?? CARD });
  await cards.getByLabel('Merchant').fill(merchant);
  await cards.getByLabel('Currency').selectOption(currency);
  await cards.getByLabel(`Amount (${currency})`).fill(amount);
  if (options.settle) await cards.getByLabel('Post immediately (no hold)').check();
  await cards.getByRole('button', { name: 'Swipe' }).click();
}

const holds = (page: Page) => page.getByRole('region', { name: 'Pending holds' });
const accountRow = (page: Page, accountNumber: string) =>
  page.getByRole('region', { name: 'Accounts' }).getByRole('row', { name: new RegExp(accountNumber) });

test('shows the seeded accounts, balances and card', async ({ page }) => {
  const main = accountRow(page, MAIN);
  await expect(main).toContainText('Private Bank Account');
  await expect(main).toContainText(/-R 35[\s,]?696[.,]04/);
  // Available = balance + R50,000 overdraft.
  await expect(main).toContainText(/R 14[\s,]?303[.,]96/);
  await expect(page.getByRole('region', { name: 'Cards' }).getByRole('row', { name: new RegExp(CARD) })).toContainText(
    'Active',
  );
});

test('a swipe places a hold that can be settled', async ({ page }) => {
  await swipe(page, 'E2E Cafe', '25.50');
  await expect(page.getByText(/Approved: R 25[.,]50 at E2E Cafe \(pending hold placed\)/)).toBeVisible();

  const hold = holds(page).getByRole('row', { name: /E2E Cafe/ });
  await expect(hold).toContainText(/R 25[.,]50/);
  // The hold reduces the available balance only.
  await expect(accountRow(page, MAIN)).toContainText(/R 14[\s,]?278[.,]46/);

  await hold.getByRole('button', { name: 'Settle' }).click();
  await expect(page.getByText(/Settled E2E Cafe/)).toBeVisible();
  await expect(hold).toHaveCount(0);
  await expect(accountRow(page, MAIN)).toContainText(/-R 35[\s,]?721[.,]54/);
});

test('a reversed hold releases the funds', async ({ page }) => {
  await swipe(page, 'Reverse Me', '100');
  const hold = holds(page).getByRole('row', { name: /Reverse Me/ });
  await expect(hold).toBeVisible();
  await hold.getByRole('button', { name: 'Reverse' }).click();
  await expect(page.getByText(/Reversed Reverse Me/)).toBeVisible();
  await expect(hold).toHaveCount(0);
  await expect(accountRow(page, MAIN)).toContainText(/R 14[\s,]?303[.,]96/);
});

test('a swipe can post immediately', async ({ page }) => {
  await swipe(page, 'Posted Shop', '10', { settle: true });
  await expect(page.getByText(/Approved: R 10[.,]00 at Posted Shop \(posted\)/)).toBeVisible();
  await expect(holds(page).getByText('No pending holds')).toBeVisible();
});

test('a stopped card is declined until reactivated', async ({ page }) => {
  const cardRow = page.getByRole('region', { name: 'Cards' }).getByRole('row', { name: new RegExp(CARD) });
  await cardRow.getByRole('button', { name: 'Stop card' }).click();
  await expect(cardRow).toContainText('Stopped');

  await swipe(page, 'Nope', '5');
  await expect(page.getByText('Declined: the card is stopped')).toBeVisible();

  await cardRow.getByRole('button', { name: 'Activate' }).click();
  await expect(cardRow).toContainText('Active');
});

test('top-ups and transfers update balances and explain refusals', async ({ page }) => {
  const saver = accountRow(page, SAVER);
  await saver.getByLabel(`Top-up amount for ${SAVER}`).fill('500');
  await saver.getByRole('button', { name: 'Top up' }).click();
  await expect(page.getByText(/Topped up .* by R 500[.,]00/)).toBeVisible();

  const accounts = page.getByRole('region', { name: 'Accounts' });
  await accounts.getByLabel('From', { exact: true }).selectOption({ label: `Mr J Soap (${SAVER})` });
  await accounts.getByLabel('To', { exact: true }).selectOption({ label: `Mr J Soap (${MAIN})` });
  await accounts.getByLabel('Amount (R)', { exact: true }).fill('1000000');
  await accounts.getByRole('button', { name: 'Transfer' }).click();
  await expect(page.getByText('Insufficient funds')).toBeVisible();
});

test('the server log shows API requests live', async ({ page }) => {
  const logs = page.getByRole('region', { name: 'Server logs' });
  await expect(logs.getByText(/Live/)).toBeVisible();
  await swipe(page, 'Log Line', '1');
  await expect(logs.getByText(/execute-live/).first()).toBeVisible();
});

test('a new card can be added and swiped in another currency', async ({ page }) => {
  const cards = page.getByRole('region', { name: 'Cards' });
  await cards.getByLabel('Account', { exact: true }).selectOption({ label: `Mr J Soap (${MAIN})` });
  await cards.getByLabel('Card number (optional)').fill('402167XXXXXX9999');
  await cards.getByRole('button', { name: 'Add card' }).click();
  await expect(page.getByText(`Card 402167XXXXXX9999 added to Mr J Soap (${MAIN})`)).toBeVisible();
  await expect(cards.getByRole('row', { name: /402167XXXXXX9999/ })).toContainText('Active');

  // USD 12.50 at the seeded R17.60 is R220.00.
  await swipe(page, 'London Books', '12.50', { currency: 'USD', card: '402167XXXXXX9999' });
  await expect(page.getByText(/Approved: USD 12\.50 \(R 220[.,]00\) at London Books \(pending hold placed\)/)).toBeVisible();
  const hold = holds(page).getByRole('row', { name: /London Books \(USD 12\.50\)/ });
  await expect(hold).toContainText(/R 220[.,]00/);
});
