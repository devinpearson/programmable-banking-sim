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

export interface SwipeInput {
  amount: number;
  merchantName: string;
  settle: boolean;
}

// The execute-live body for a point-of-sale swipe. Amounts go in cents.
export function buildSwipeRequest(input: SwipeInput) {
  return {
    currencyCode: 'ZAR',
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
};

// One line describing what happened to a swipe.
export function describeSwipe(result: SwipeOutcome, amount: number, merchantName: string): string {
  if (result.result) {
    const outcome = !result.transaction
      ? ''
      : result.transaction.status === 'POSTED'
        ? ' (posted)'
        : ' (pending hold placed)';
    return `Approved: ${formatMoney(amount)} at ${merchantName}${outcome}`;
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
