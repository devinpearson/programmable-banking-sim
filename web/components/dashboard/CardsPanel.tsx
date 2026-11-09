'use client';

import { useState } from 'react';
import { Ban, CheckCircle2, CreditCard, RefreshCw } from 'lucide-react';
import { Button, EmptyState, Field, Input, Panel, Select, Table, Th } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useAction, useToast } from '@/components/ToastProvider';
import { useAccountsOverview, useCards, useRefreshSandbox } from '@/hooks/useSandbox';
import { setCardStatus, swipeCard } from '@/lib/api/sandbox';
import type { Card } from '@/lib/api/types';
import { accountLabel, describeSwipe, isCardActive, parseAmount } from '@/lib/banking';

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
  const [form, setForm] = useState({ cardKey: '', merchantName: '', amount: '', settle: false });
  const notify = useToast();
  const refresh = useRefreshSandbox();
  const amount = parseAmount(form.amount);

  async function submit() {
    if (!form.cardKey || amount === null) return;
    const merchantName = form.merchantName.trim() || 'Corner Cafe';
    try {
      const result = await swipeCard(form.cardKey, { amount, merchantName, settle: form.settle });
      notify(describeSwipe(result, amount, merchantName), { error: !result.result });
      if (result.result) setForm(f => ({ ...f, amount: '' }));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Swipe failed', { error: true });
    }
    await refresh();
  }

  return (
    <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Swipe a card</h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Runs the card&apos;s published code like a point-of-sale purchase. An approved swipe places a pending hold
        on the card&apos;s account, unless you post it immediately.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-end">
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
        <Field label="Amount (R)" htmlFor="swipe-amount">
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
    </div>
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
      description="Stop a card to see swipes declined, or swipe one to test your card code end to end."
      actions={
        <Button variant="secondary" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      {isLoading && <LoadingState message="Loading cards..." />}
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {cards && cards.length === 0 && <EmptyState>No cards yet. Load a scenario or reset the data above.</EmptyState>}
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
    </Panel>
  );
}
