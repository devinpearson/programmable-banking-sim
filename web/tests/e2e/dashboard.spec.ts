import { expect, test, type Page } from '@playwright/test';
import { openForm, showTab } from './dashboard';
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
  await openForm(cards, 'Swipe a card');
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
  await openForm(accounts, 'Transfer between accounts');
  await accounts.getByLabel('From', { exact: true }).selectOption({ label: `Mr J Soap (${SAVER})` });
  await accounts.getByLabel('To', { exact: true }).selectOption({ label: `Mr J Soap (${MAIN})` });
  await accounts.getByLabel('Amount (R)', { exact: true }).fill('1000000');
  await accounts.getByRole('button', { name: 'Transfer' }).click();
  await expect(page.getByText('Insufficient funds')).toBeVisible();
});

test('the server log shows API requests live', async ({ page }) => {
  await swipe(page, 'Log Line', '1');
  await showTab(page, 'Sandbox');
  const logs = page.getByRole('region', { name: 'Server logs' });
  await expect(logs.getByText(/Live/)).toBeVisible();
  await expect(logs.getByText(/execute-live/).first()).toBeVisible();
});

test('a new card can be added and swiped in another currency', async ({ page }) => {
  const cards = page.getByRole('region', { name: 'Cards' });
  await openForm(cards, 'Add a card');
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

test('transaction history filters by type and period, with holds on top', async ({ page }) => {
  const history = page.getByRole('region', { name: 'Transactions', exact: true });
  const rows = history.locator('tbody tr');
  // The 13 seeded transactions on the main account (all from 2022–2023).
  await expect(rows).toHaveCount(13);
  await expect(rows.first()).toContainText('UBEREATS');
  await expect(rows.first()).toContainText(/-R 35[\s,]?696[.,]04/);

  await history.getByLabel('Type').selectOption('FasterPay');
  await expect(rows).toHaveCount(4);
  await history.getByLabel('Type').selectOption('');

  await history.getByLabel('Period').selectOption('30d');
  await expect(history.getByText('No transactions match these filters.')).toBeVisible();
  await history.getByLabel('Period').selectOption('all');

  // A swipe appears at the top as a pending hold.
  await swipe(page, 'History Cafe', '15');
  await expect(rows.first()).toContainText('Pending');
  await expect(rows.first()).toContainText('History Cafe');
});

test('paying a beneficiary updates the beneficiary and the history', async ({ page }) => {
  const beneficiaries = page.getByRole('region', { name: 'Beneficiaries' });
  await openForm(beneficiaries, 'Pay a beneficiary');
  await beneficiaries.getByLabel('From account').selectOption({ label: `Mr J Soap (${MAIN})` });
  await beneficiaries.getByLabel('Beneficiary', { exact: true }).selectOption({ label: 'S Jones' });
  await beneficiaries.getByLabel('Amount (R)').fill('250');
  await beneficiaries.getByLabel('My reference').fill('Rent share');
  await beneficiaries.getByRole('button', { name: 'Pay' }).click();
  await expect(page.getByText(/Paid R 250[.,]00 to S Jones \(ref UBP\d{10}\)/)).toBeVisible();

  await expect(beneficiaries.getByRole('row', { name: /S Jones/ })).toContainText('R 250.00');
  const latest = page.getByRole('region', { name: 'Transactions', exact: true }).locator('tbody tr').first();
  await expect(latest).toContainText('Rent share');
  await expect(latest).toContainText('OnlineBankingPayments');
  await expect(latest).toContainText(/-R 250[.,]00/);
});

test('a payment the account cannot cover is refused with a reason', async ({ page }) => {
  const beneficiaries = page.getByRole('region', { name: 'Beneficiaries' });
  await openForm(beneficiaries, 'Pay a beneficiary');
  await beneficiaries.getByLabel('From account').selectOption({ label: `Mr J Soap (${SAVER})` });
  await beneficiaries.getByLabel('Beneficiary', { exact: true }).selectOption({ label: 'Discovery CC' });
  await beneficiaries.getByLabel('Amount (R)').fill('100');
  await beneficiaries.getByRole('button', { name: 'Pay' }).click();
  await expect(page.getByText('Insufficient funds')).toBeVisible();
});

test('forms start folded and stay open once opened; the tab is in the URL', async ({ page }) => {
  const cards = page.getByRole('region', { name: 'Cards' });
  await expect(cards.getByLabel('Merchant')).toBeHidden();
  await openForm(cards, 'Swipe a card');
  await expect(cards.getByLabel('Merchant')).toBeVisible();

  await showTab(page, 'Simulate');
  await expect(page).toHaveURL(/#simulate$/);
  await expect(page.getByRole('region', { name: 'Webhooks' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Accounts' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Simulate' })).toHaveAttribute('aria-selected', 'true');
  await showTab(page, 'Banking');
  await expect(page.getByRole('region', { name: 'Cards' }).getByLabel('Merchant')).toBeVisible();
});
