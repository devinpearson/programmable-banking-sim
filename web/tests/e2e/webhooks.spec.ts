import { expect, test } from '@playwright/test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { openForm, showTab } from './dashboard';
import { API_URL } from './servers';

// A real receiver in the test process; the sandbox API delivers to it.
let receiver: http.Server;
let receiverUrl: string;
const received: { event: string; data: Record<string, unknown> }[] = [];

test.beforeAll(async () => {
  receiver = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const json = JSON.parse(body);
      received.push({ event: json.event, data: json.data });
      res.end('ok');
    });
  });
  await new Promise<void>(resolve => receiver.listen(0, '127.0.0.1', resolve));
  receiverUrl = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}/hook`;
});

test.afterAll(async ({ request }) => {
  // Webhooks survive a data reset; remove the ones this file made.
  const { data } = await (await request.get(`${API_URL}/webhooks`)).json();
  for (const webhook of data.webhooks) await request.delete(`${API_URL}/webhooks/${webhook.webhookId}`);
  await new Promise<void>(resolve => receiver.close(() => resolve()));
});

test('register a webhook, send a test, and see a swipe delivered live', async ({ page, request }) => {
  expect((await request.get(`${API_URL}/restore`)).ok()).toBe(true);
  await page.goto('/#simulate');
  const panel = page.getByRole('region', { name: 'Webhooks' });
  await openForm(panel, 'Register a webhook');

  await panel.getByLabel('URL').fill(receiverUrl);
  await panel.getByLabel('card.authorization').check();
  await panel.getByRole('button', { name: 'Register webhook' }).click();
  await expect(page.getByText(`Webhook registered for ${receiverUrl}`)).toBeVisible();
  const row = panel.getByRole('row', { name: new RegExp(receiverUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
  await expect(row).toContainText('card.authorization');

  const deliveries = panel.getByRole('region', { name: /Recent deliveries/ });
  await row.getByRole('button', { name: 'Send test' }).click();
  await expect(deliveries.getByRole('row', { name: /webhook\.test/ })).toContainText('Delivered (200)');
  expect(received.map(r => r.event)).toContain('webhook.test');

  // Swipe the seeded card: the authorization shows up in the log by itself.
  await showTab(page, 'Banking');
  const cards = page.getByRole('region', { name: 'Cards' });
  await openForm(cards, 'Swipe a card');
  await cards.getByLabel('Card', { exact: true }).selectOption({ label: '402167XXXXXX1111' });
  await cards.getByLabel('Merchant').fill('Webhook Cafe');
  await cards.getByLabel('Amount (ZAR)').fill('20');
  await cards.getByRole('button', { name: 'Swipe' }).click();
  await showTab(page, 'Simulate');
  await expect(deliveries.getByRole('row', { name: /card\.authorization/ })).toContainText('Delivered (200)');

  const authorization = received.find(r => r.event === 'card.authorization');
  expect(authorization?.data).toMatchObject({ approved: true, merchant: { name: 'Webhook Cafe' } });
});
