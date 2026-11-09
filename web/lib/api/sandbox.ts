import { apiUrl, fetchAPI, fetchData, postJSON } from './common';
import type {
  Account,
  AccountWithBalance,
  Balance,
  Card,
  CardStatus,
  ConsentDetails,
  CreatedCard,
  Beneficiary,
  BeneficiaryCategory,
  ExchangeRate,
  Transaction,
  DatabaseSummary,
  PendingTransaction,
  Scenario,
  Settings,
  SwipeResult,
  Webhook,
  WebhookDelivery,
  FaultConfig,
  TransferResponses,
} from './types';
import { buildSwipeRequest, newestFirst, type SwipeInput } from '../banking';

const ACCOUNTS = '/za/pb/v1/accounts';
const CARDS = '/za/v1/cards';

// Accounts with balances, plus every pending hold, in one pass: the dashboard
// shows both and they change together.
export async function getAccountsOverview(): Promise<{
  accounts: AccountWithBalance[];
  pendingHolds: PendingTransaction[];
}> {
  const { accounts } = await fetchData<{ accounts: Account[] }>(ACCOUNTS);
  const rows = await Promise.all(
    accounts.map(async account => {
      const [balance, pending] = await Promise.all([
        fetchData<Balance>(`${ACCOUNTS}/${account.accountId}/balance`),
        fetchData<{ pendingTransactions: PendingTransaction[] }>(
          `${ACCOUNTS}/${account.accountId}/pending-transactions`,
        ),
      ]);
      return {
        account: {
          ...account,
          currentBalance: balance.currentBalance,
          availableBalance: balance.availableBalance,
        },
        holds: pending.pendingTransactions,
      };
    }),
  );
  return {
    accounts: rows.map(row => row.account),
    pendingHolds: newestFirst(rows.flatMap(row => row.holds)),
  };
}

export function topUp(accountId: string, amount: number) {
  return fetchData(`${ACCOUNTS}/${accountId}/topup`, postJSON({ amount }));
}

export function transfer(from: string, to: string, amount: number, reference: string) {
  return fetchData<TransferResponses>(
    `${ACCOUNTS}/${from}/transfermultiple`,
    postJSON({
      transferList: [{ beneficiaryAccountId: to, amount, myReference: reference, theirReference: reference }],
    }),
  );
}

export interface TransactionFilters {
  fromDate?: string;
  toDate?: string;
  transactionType?: string;
  includePending?: boolean;
}

export async function getTransactions(accountId: string, filters: TransactionFilters): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  if (filters.transactionType) params.set('transactionType', filters.transactionType);
  if (filters.includePending) params.set('includePending', 'true');
  const query = params.size > 0 ? `?${params}` : '';
  return (await fetchData<{ transactions: Transaction[] }>(`${ACCOUNTS}/${accountId}/transactions${query}`)).transactions;
}

export async function getBeneficiaries(): Promise<Beneficiary[]> {
  return (await fetchData<{ result: Beneficiary[] }>(`${ACCOUNTS}/beneficiaries`)).result;
}

export function getBeneficiaryCategories() {
  return fetchData<BeneficiaryCategory[]>(`${ACCOUNTS}/beneficiarycategories`);
}

export interface Payment {
  beneficiaryId: string;
  amount: number;
  myReference: string;
  theirReference: string;
}

export function payBeneficiary(fromAccountId: string, payment: Payment) {
  return fetchData<TransferResponses>(`${ACCOUNTS}/${fromAccountId}/paymultiple`, postJSON({ paymentList: [payment] }));
}

export async function getWebhooks(): Promise<Webhook[]> {
  return (await fetchData<{ webhooks: Webhook[] }>('/webhooks')).webhooks;
}

export async function getWebhookEvents(): Promise<string[]> {
  return (await fetchData<{ events: string[] }>('/webhooks/events')).events;
}

export interface NewWebhook {
  url: string;
  events?: string[];
  secret?: string;
}

export function createWebhook(webhook: NewWebhook) {
  return fetchData<Webhook>('/webhooks', postJSON(webhook));
}

export function setWebhookActive(webhookId: string, active: boolean) {
  return fetchData<Webhook>(`/webhooks/${webhookId}`, { method: 'PATCH', body: JSON.stringify({ active }) });
}

export function deleteWebhook(webhookId: string) {
  return fetchAPI(`/webhooks/${webhookId}`, { method: 'DELETE' });
}

export function testWebhook(webhookId: string) {
  return fetchData<WebhookDelivery>(`/webhooks/${webhookId}/test`, { method: 'POST' });
}

export async function getWebhookDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
  return (await fetchData<{ deliveries: WebhookDelivery[] }>(`/webhooks/${webhookId}/deliveries?limit=20`)).deliveries;
}

export function getFaults() {
  return fetchData<FaultConfig>('/faults');
}

export type FaultSettings = Omit<FaultConfig, 'active'>;

export function saveFaults(settings: FaultSettings) {
  return fetchData<FaultConfig>('/faults', { method: 'PUT', body: JSON.stringify(settings) });
}

export function turnOffFaults() {
  return fetchData<FaultConfig>('/faults', { method: 'DELETE' });
}

export function settleHold(hold: PendingTransaction) {
  return fetchData(
    `${ACCOUNTS}/${hold.accountId}/pending-transactions/${hold.transactionId}/settle`,
    { method: 'POST' },
  );
}

export function reverseHold(hold: PendingTransaction) {
  return fetchAPI(`${ACCOUNTS}/${hold.accountId}/pending-transactions/${hold.transactionId}`, {
    method: 'DELETE',
  });
}

export async function getCards(): Promise<Card[]> {
  return (await fetchData<{ cards: Card[] }>(CARDS)).cards;
}

export function setCardStatus(cardKey: string, status: CardStatus) {
  return fetchData(`${CARDS}/${cardKey}/status`, postJSON({ status }));
}

export interface NewCard {
  accountId: string;
  cardNumber?: string;
  isProgrammable: boolean;
}

export function createCard(card: NewCard) {
  return fetchData<CreatedCard>(CARDS, postJSON(card));
}

export async function getExchangeRates(): Promise<ExchangeRate[]> {
  return (await fetchData<{ rates: ExchangeRate[] }>('/exchange-rates')).rates;
}

export function swipeCard(cardKey: string, input: SwipeInput) {
  return fetchData<SwipeResult>(`${CARDS}/${cardKey}/code/execute-live`, postJSON(buildSwipeRequest(input)));
}

export function getScenarios() {
  return fetchData<Scenario[]>('/scenarios');
}

export function loadScenario(id: string) {
  return fetchData<{ id: string; name: string }>(`/scenarios/${id}`, { method: 'POST' });
}

export function getSummary() {
  return fetchData<DatabaseSummary>('/database-summary');
}

export function resetDatabase() {
  return fetchAPI('/restore');
}

export function clearDatabase() {
  return fetchAPI('/clear', { method: 'DELETE' });
}

export function getSettings() {
  return fetchData<Settings>('/envs');
}

export function saveSettings(settings: Settings) {
  return fetchAPI<Settings>('/envs', postJSON(settings));
}

// OAuth pages. The browser navigates to these API URLs (they redirect), so
// they are URLs rather than fetches.
export function getConsent(qsp: string) {
  return fetchData<ConsentDetails>(`/identity/consent?qsp=${encodeURIComponent(qsp)}`);
}

export function loginActionUrl(): string {
  return apiUrl('/login');
}

export function approveUrl(qsp: string, accountNumbers: string[]): string {
  const params = new URLSearchParams({ qsp });
  if (accountNumbers.length > 0) {
    params.set('selectedAccounts', JSON.stringify(accountNumbers));
  }
  return apiUrl(`/identity/approve?${params}`);
}

export function declineUrl(qsp: string): string {
  return apiUrl(`/identity/decline?${new URLSearchParams({ qsp })}`);
}
