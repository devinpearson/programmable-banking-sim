import { describe, expect, it } from 'vitest';
import {
  MAX_LOG_LINES,
  accountLabel,
  appendLog,
  buildSwipeRequest,
  describeSwipe,
  formatMoney,
  isCardActive,
  newestFirst,
  parseAmount,
  transferError,
} from './banking';
import type { AccountWithBalance, PendingTransaction } from './api/types';

describe('formatMoney', () => {
  it('formats rands with two decimals', () => {
    expect(formatMoney(1234.5)).toBe(`R ${(1234.5).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`);
  });
  it('puts the sign before the currency', () => {
    expect(formatMoney(-40.99)).toMatch(/^-R 40[.,]99$/);
  });
  it('accepts decimal strings from the API', () => {
    expect(formatMoney('250.5')).toMatch(/^R 250[.,]50$/);
  });
  it('treats missing or invalid values as zero', () => {
    expect(formatMoney(undefined)).toMatch(/^R 0[.,]00$/);
    expect(formatMoney('abc')).toMatch(/^R 0[.,]00$/);
  });
});

describe('parseAmount', () => {
  it('accepts positive numbers', () => {
    expect(parseAmount('12.34')).toBe(12.34);
  });
  it('rejects empty, zero, negative and non-numeric input', () => {
    for (const value of ['', '  ', '0', '-5', 'abc']) {
      expect(parseAmount(value)).toBeNull();
    }
  });
});

describe('transferError', () => {
  it('needs both accounts', () => {
    expect(transferError({ from: 'a', to: '', amount: '10' })).toBe('Pick both accounts');
  });
  it('refuses the same account twice', () => {
    expect(transferError({ from: 'a', to: 'a', amount: '10' })).toBe('Pick two different accounts');
  });
  it('needs a positive amount', () => {
    expect(transferError({ from: 'a', to: 'b', amount: '0' })).toBe('Enter an amount greater than zero');
  });
  it('is null for a valid transfer', () => {
    expect(transferError({ from: 'a', to: 'b', amount: '10' })).toBeNull();
  });
});

describe('buildSwipeRequest', () => {
  it('converts rands to whole cents', () => {
    expect(buildSwipeRequest({ amount: 19.99, merchantName: 'Shop', settle: false }).centsAmount).toBe(1999);
    expect(buildSwipeRequest({ amount: 0.1 + 0.2, merchantName: 'Shop', settle: false }).centsAmount).toBe(30);
  });
  it('defaults a blank merchant and passes settle through', () => {
    const body = buildSwipeRequest({ amount: 5, merchantName: '  ', settle: true });
    expect(body.merchantName).toBe('Corner Cafe');
    expect(body.settle).toBe(true);
    expect(body).toMatchObject({ currencyCode: 'ZAR', countryCode: 'ZA', merchantCode: '5411' });
  });
});

describe('describeSwipe', () => {
  it('describes an approved hold', () => {
    const text = describeSwipe({ result: true, transaction: { transactionId: 1, status: 'PENDING' } }, 50, 'Cafe');
    expect(text).toMatch(/^Approved: R 50[.,]00 at Cafe \(pending hold placed\)$/);
  });
  it('describes an approved, posted swipe', () => {
    expect(describeSwipe({ result: true, transaction: { transactionId: 1, status: 'POSTED' } }, 5, 'Cafe')).toContain(
      '(posted)',
    );
  });
  it('describes an approved swipe on a card with no account', () => {
    expect(describeSwipe({ result: true, transaction: null }, 5, 'Cafe')).toMatch(/at Cafe$/);
  });
  it('explains each decline reason', () => {
    expect(describeSwipe({ result: false, reason: 'insufficient_funds', transaction: null }, 5, 'x')).toBe(
      'Declined: insufficient funds',
    );
    expect(describeSwipe({ result: false, reason: 'card_not_active', transaction: null }, 5, 'x')).toBe(
      'Declined: the card is stopped',
    );
    expect(describeSwipe({ result: false, transaction: null }, 5, 'x')).toBe('Declined: declined by the card code');
  });
});

describe('isCardActive', () => {
  it('ignores case', () => {
    expect(isCardActive({ status: 'ACTIVE' })).toBe(true);
    expect(isCardActive({ status: 'Active' })).toBe(true);
    expect(isCardActive({ status: 'Stopped' })).toBe(false);
  });
});

describe('accountLabel', () => {
  const accounts = [{ accountId: 'a1', accountName: 'Main', accountNumber: '100' }] as AccountWithBalance[];
  it('names a known account', () => {
    expect(accountLabel(accounts, 'a1')).toBe('Main (100)');
  });
  it('says when a card has no linked account', () => {
    expect(accountLabel(accounts, 'missing')).toBe('No linked account');
  });
});

describe('newestFirst', () => {
  it('sorts holds by descending id without mutating the input', () => {
    const holds = [{ transactionId: 1 }, { transactionId: 3 }, { transactionId: 2 }] as PendingTransaction[];
    expect(newestFirst(holds).map(h => h.transactionId)).toEqual([3, 2, 1]);
    expect(holds.map(h => h.transactionId)).toEqual([1, 3, 2]);
  });
});

describe('appendLog', () => {
  it('appends a line', () => {
    expect(appendLog(['a'], 'b')).toEqual(['a', 'b']);
  });
  it('drops the oldest lines past the limit', () => {
    const full = Array.from({ length: MAX_LOG_LINES }, (_, i) => String(i));
    const next = appendLog(full, 'new');
    expect(next).toHaveLength(MAX_LOG_LINES);
    expect(next[0]).toBe('1');
    expect(next.at(-1)).toBe('new');
  });
});
