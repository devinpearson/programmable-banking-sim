// Pure helpers behind the dashboard: formatting, validation and request
// building. Kept free of React and fetch so they are easy to unit-test.

import type { AccountWithBalance, Card, PendingTransaction, SwipeResult } from './api/types';

export function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = Math.abs(safe).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${safe < 0 ? '-' : ''}R ${formatted}`;
}

// A positive amount in rands from a form field, or null.
export function parseAmount(value: string): number | null {
  if (value.trim() === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export interface TransferInput {
  from: string;
  to: string;
  amount: string;
}

// The problem with a transfer form, or null when it can be sent.
export function transferError(input: TransferInput): string | null {
  if (!input.from || !input.to) return 'Pick both accounts';
  if (input.from === input.to) return 'Pick two different accounts';
  if (parseAmount(input.amount) === null) return 'Enter an amount greater than zero';
  return null;
}

// An amount in any currency: rand as "R 12,50", others as "USD 12.50".
export function formatCurrency(currencyCode: string, amount: number): string {
  if (currencyCode.toUpperCase() === 'ZAR') return formatMoney(amount);
  return `${currencyCode.toUpperCase()} ${amount.toFixed(2)}`;
}

export interface SwipeInput {
  amount: number;
  currencyCode: string;
  merchantName: string;
  settle: boolean;
}

// The execute-live body for a point-of-sale swipe. Amounts go in cents of
// the purchase currency; the sandbox converts them to rand.
export function buildSwipeRequest(input: SwipeInput) {
  return {
    currencyCode: input.currencyCode.toUpperCase(),
    centsAmount: Math.round(input.amount * 100),
    merchantCode: '5411',
    merchantName: input.merchantName.trim() || 'Corner Cafe',
    merchantCity: 'Cape Town',
    countryCode: 'ZA',
    settle: input.settle,
  };
}

// The parts of a swipe result describeSwipe reads.
type SwipeOutcome = Pick<SwipeResult, 'result' | 'reason'> & {
  transaction: Pick<NonNullable<SwipeResult['transaction']>, 'status'> | null;
  exchange?: Pick<NonNullable<SwipeResult['exchange']>, 'currencyCode' | 'amount' | 'zarAmount'> | null;
};

// The amount as the customer sees it: a foreign purchase with what it cost
// in rand, e.g. "USD 12.50 (R 220,00)".
function swipeAmount(result: SwipeOutcome, amount: number): string {
  const exchange = result.exchange;
  if (!exchange) return formatMoney(amount);
  return `${formatCurrency(exchange.currencyCode, exchange.amount)} (${formatMoney(exchange.zarAmount)})`;
}

// One line describing what happened to a swipe.
export function describeSwipe(result: SwipeOutcome, amount: number, merchantName: string): string {
  if (result.result) {
    const outcome = !result.transaction
      ? ''
      : result.transaction.status === 'POSTED'
        ? ' (posted)'
        : ' (pending hold placed)';
    return `Approved: ${swipeAmount(result, amount)} at ${merchantName}${outcome}`;
  }
  if (result.reason === 'insufficient_funds' && result.exchange) {
    return `Declined: insufficient funds for ${swipeAmount(result, amount)}`;
  }
  const reasons: Record<string, string> = {
    insufficient_funds: 'insufficient funds',
    card_not_active: 'the card is stopped',
  };
  return `Declined: ${reasons[result.reason ?? ''] ?? 'declined by the card code'}`;
}

export function isCardActive(card: Pick<Card, 'status'>): boolean {
  return String(card.status).toLowerCase() === 'active';
}

export function accountLabel(accounts: AccountWithBalance[], accountId: string): string {
  const account = accounts.find(a => a.accountId === accountId);
  return account ? `${account.accountName} (${account.accountNumber})` : 'No linked account';
}

export function newestFirst(holds: PendingTransaction[]): PendingTransaction[] {
  return [...holds].sort((a, b) => b.transactionId - a.transactionId);
}

// Server log lines kept in the dashboard, oldest dropped first.
export const MAX_LOG_LINES = 500;

export function appendLog(lines: string[], line: string): string[] {
  const next = [...lines, line];
  return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
}

// --- Transaction history ----------------------------------------------------

// Debits count against the account: shown as negative amounts.
export function signedAmount(transaction: { type: string; amount: string | number }): number {
  const amount = Number(transaction.amount);
  return transaction.type === 'DEBIT' ? -amount : amount;
}

// The transactionType values the sandbox and Investec use, for filtering.
export const TRANSACTION_TYPES = [
  'CardPurchases',
  'CardWithdrawals',
  'DebitOrders',
  'Deposits',
  'FasterPay',
  'FeesAndInterest',
  'OnlineBankingPayments',
  'OnlineBankingTransfers',
] as const;

export const PERIODS = [
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '180d', label: 'Last 180 days', days: 180 },
  { id: 'all', label: 'All time', days: null },
] as const;

export type PeriodId = (typeof PERIODS)[number]['id'];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// The fromDate/toDate for a period, ending today. "All time" starts in 2000,
// before any sandbox data (the API's own default is the last 180 days).
export function periodRange(period: PeriodId, today = new Date()): { fromDate: string; toDate: string } {
  const toDate = isoDate(today);
  const days = PERIODS.find(p => p.id === period)?.days ?? null;
  if (days === null) return { fromDate: '2000-01-01', toDate };
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - days);
  return { fromDate: isoDate(from), toDate };
}

// --- Beneficiary payments ---------------------------------------------------

export interface PaymentInput {
  from: string;
  beneficiaryId: string;
  amount: string;
}

// The problem with a payment form, or null when it can be sent.
export function paymentError(input: PaymentInput): string | null {
  if (!input.from) return 'Pick the account to pay from';
  if (!input.beneficiaryId) return 'Pick a beneficiary';
  if (parseAmount(input.amount) === null) return 'Enter an amount greater than zero';
  return null;
}

// --- Fault injection --------------------------------------------------------

export interface FaultSummaryInput {
  errorRate: number;
  errorStatus: number;
  timeoutRate: number;
  latencyMs: number;
  pathPrefix: string;
}

// One line saying what the sandbox is doing to requests, e.g.
// "20% of requests get 503 · 500 ms extra latency · on /za/v1/cards".
export function describeFaults(config: FaultSummaryInput): string {
  const parts: string[] = [];
  if (config.errorRate > 0) parts.push(`${config.errorRate}% of requests get ${config.errorStatus}`);
  if (config.timeoutRate > 0) parts.push(`${config.timeoutRate}% time out`);
  if (config.latencyMs > 0) parts.push(`${config.latencyMs} ms extra latency`);
  if (parts.length === 0) return 'No faults';
  parts.push(config.pathPrefix ? `on ${config.pathPrefix}` : 'on all /za requests and tokens');
  return parts.join(' · ');
}

// " (ref UBP2201761367)" for a transfer or payment response, or ''.
export function referenceSuffix(response: { TransferResponses: { PaymentReferenceNumber: string }[] } | undefined): string {
  const reference = response?.TransferResponses[0]?.PaymentReferenceNumber;
  return reference ? ` (ref ${reference})` : '';
}
