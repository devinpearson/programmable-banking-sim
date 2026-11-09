import { apiUrl, fetchAPI, fetchData, postJSON } from './common';
import type {
  Account,
  AccountWithBalance,
  Balance,
  Card,
  CardStatus,
  ConsentDetails,
  DatabaseSummary,
  PendingTransaction,
  Scenario,
  Settings,
  SwipeResult,
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
  return fetchData(
    `${ACCOUNTS}/${from}/transfermultiple`,
    postJSON({
      transferList: [{ beneficiaryAccountId: to, amount, myReference: reference, theirReference: reference }],
    }),
  );
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
