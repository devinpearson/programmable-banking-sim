'use client';

import { useState } from 'react';
import { Ban, CheckCircle2, CreditCard, Plus, RefreshCw } from 'lucide-react';
import Disclosure from '@/components/Disclosure';
import { Button, EmptyState, Field, Input, Panel, Select, Table, Th } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useAction, useToast } from '@/components/ToastProvider';
import { useAccountsOverview, useCards, useExchangeRates, useRefreshSandbox } from '@/hooks/useSandbox';
import { createCard, setCardStatus, swipeCard } from '@/lib/api/sandbox';
import type { AccountWithBalance, Card } from '@/lib/api/types';
import { accountLabel, describeSwipe, formatMoney, isCardActive, parseAmount } from '@/lib/banking';

function StatusBadge({ card }: { card: Card }) {
  const active = isCardActive(card);
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
        active
          ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
          : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
      }`}
    >
      {active ? 'Active' : 'Stopped'}
    </span>
  );
}

function SwipeForm({ cards }: { cards: Card[] }) {
  const [form, setForm] = useState({ cardKey: '', currencyCode: 'ZAR', merchantName: '', amount: '', settle: false });
  const { data: rates = [] } = useExchangeRates();
  const notify = useToast();
  const refresh = useRefreshSandbox();
  const amount = parseAmount(form.amount);
  // Rand first, then the other currencies with a rate.
  const currencies = ['ZAR', ...rates.map(r => r.currencyCode).filter(code => code !== 'ZAR')];
  const rate = rates.find(r => r.currencyCode === form.currencyCode);
  const foreign = form.currencyCode !== 'ZAR';

  async function submit() {
    if (!form.cardKey || amount === null) return;
    const merchantName = form.merchantName.trim() || 'Corner Cafe';
    try {
      const result = await swipeCard(form.cardKey, {
        amount,
        currencyCode: form.currencyCode,
        merchantName,
        settle: form.settle,
      });
      notify(describeSwipe(result, amount, merchantName), { error: !result.result });
      if (result.result) setForm(f => ({ ...f, amount: '' }));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Swipe failed', { error: true });
    }
    await refresh();
  }

  return (
    <Disclosure id="swipe-card" title="Swipe a card">
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Runs the card&apos;s published code like a point-of-sale purchase. An approved swipe places a pending hold
        on the card&apos;s account, unless you post it immediately. Foreign purchases are charged in rand at the
        sandbox exchange rate.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end lg:grid-cols-6">
        <Field label="Card" htmlFor="swipe-card">
          <Select id="swipe-card" value={form.cardKey} onChange={e => setForm({ ...form, cardKey: e.target.value })}>
            <option value="">Select card</option>
            {cards.map(c => (
              <option key={c.CardKey} value={c.CardKey}>
                {c.CardNumber}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Merchant" htmlFor="swipe-merchant">
          <Input
            id="swipe-merchant"
            placeholder="Corner Cafe"
            value={form.merchantName}
            onChange={e => setForm({ ...form, merchantName: e.target.value })}
          />
        </Field>
        <Field label="Currency" htmlFor="swipe-currency">
          <Select
            id="swipe-currency"
            value={form.currencyCode}
            onChange={e => setForm({ ...form, currencyCode: e.target.value })}
          >
            {currencies.map(code => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <Field label={`Amount (${form.currencyCode})`} htmlFor="swipe-amount">
            <Input
              id="swipe-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          {foreign && rate && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              1 {form.currencyCode} = {formatMoney(rate.zarPerUnit)}
              {amount !== null && <> · charged ≈ {formatMoney(Math.round(amount * 100 * rate.zarPerUnit) / 100)}</>}
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 sm:pb-2 dark:text-gray-300">
          <input
            type="checkbox"
            checked={form.settle}
            onChange={e => setForm({ ...form, settle: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          Post immediately (no hold)
        </label>
        <Button disabled={!form.cardKey || amount === null} onClick={submit}>
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          Swipe
        </Button>
      </div>
    </Disclosure>
  );
}

function AddCardForm({ accounts }: { accounts: AccountWithBalance[] }) {
  const [form, setForm] = useState({ accountId: '', cardNumber: '', isProgrammable: true });
  const run = useAction();
  const refresh = useRefreshSandbox();

  async function submit() {
    if (!form.accountId) return;
    const card = await run(
      () =>
        createCard({
          accountId: form.accountId,
          isProgrammable: form.isProgrammable,
          ...(form.cardNumber.trim() ? { cardNumber: form.cardNumber.trim() } : {}),
        }),
      created => `Card ${created.cardNumber} added to ${accountLabel(accounts, created.accountId)}`,
    );
    if (card) setForm(f => ({ ...f, cardNumber: '' }));
    await refresh();
  }

  return (
    <Disclosure id="add-card" title="Add a card">
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Issues a card on an account. It starts active, with the starter code saved and published, so it can be
        swiped straight away.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4">
        <Field label="Account" htmlFor="new-card-account">
          <Select
            id="new-card-account"
            value={form.accountId}
            onChange={e => setForm({ ...form, accountId: e.target.value })}
          >
            <option value="">Select account</option>
            {accounts.map(a => (
              <option key={a.accountId} value={a.accountId}>
                {a.accountName} ({a.accountNumber})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Card number (optional)" htmlFor="new-card-number">
          <Input
            id="new-card-number"
            placeholder="Generated, e.g. 402167XXXXXX1234"
            value={form.cardNumber}
            onChange={e => setForm({ ...form, cardNumber: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 sm:pb-2 dark:text-gray-300">
          <input
            type="checkbox"
            checked={form.isProgrammable}
            onChange={e => setForm({ ...form, isProgrammable: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          Programmable
        </label>
        <Button variant="dark" disabled={!form.accountId} onClick={submit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add card
        </Button>
      </div>
    </Disclosure>
  );
}

export default function CardsPanel() {
  const { data: cards, error, isLoading, mutate } = useCards();
  const { data: overview } = useAccountsOverview();
  const run = useAction();
  const accounts = overview?.accounts ?? [];

  async function toggle(card: Card) {
    const status = isCardActive(card) ? 'Stopped' : 'Active';
    await run(() => setCardStatus(card.CardKey, status), `${card.CardNumber} ${status === 'Active' ? 'activated' : 'stopped'}`);
    await mutate();
  }

  return (
    <Panel
      id="cards"
      title="Cards"
      description="Add cards, stop them to see swipes declined, or swipe one to test your card code end to end."
      actions={
        <Button variant="secondary" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      {isLoading && <LoadingState message="Loading cards..." />}
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {cards && cards.length === 0 && (
        <EmptyState>
          No cards yet.{' '}
          {accounts.length > 0 ? 'Add one below.' : 'Load a scenario or reset the data above.'}
        </EmptyState>
      )}
      {cards && cards.length > 0 && (
        <>
          <Table
            head={
              <>
                <Th>Card</Th>
                <Th>Account</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </>
            }
          >
            {cards.map(card => (
              <tr key={card.CardKey}>
                <td className="py-2 pr-4 font-mono text-gray-900 dark:text-gray-100">{card.CardNumber}</td>
                <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{accountLabel(accounts, card.AccountId)}</td>
                <td className="py-2 pr-4">
                  <StatusBadge card={card} />
                </td>
                <td className="py-2 pr-4 text-right">
                  <Button variant="secondary" onClick={() => toggle(card)}>
                    {isCardActive(card) ? (
                      <>
                        <Ban className="h-4 w-4" aria-hidden="true" />
                        Stop card
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Activate
                      </>
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          <SwipeForm cards={cards} />
        </>
      )}
      {cards && accounts.length > 0 && <AddCardForm accounts={accounts} />}
    </Panel>
  );
}
