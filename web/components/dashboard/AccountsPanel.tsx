'use client';

import { useState } from 'react';
import { ArrowRightLeft, Plus, RefreshCw } from 'lucide-react';
import { Button, EmptyState, Field, Input, Panel, Select, Table, Th } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useAction } from '@/components/ToastProvider';
import { useAccountsOverview, useRefreshSandbox } from '@/hooks/useSandbox';
import { topUp, transfer } from '@/lib/api/sandbox';
import type { AccountWithBalance } from '@/lib/api/types';
import { formatMoney, parseAmount, transferError } from '@/lib/banking';

function TopUp({ account }: { account: AccountWithBalance }) {
  const [amount, setAmount] = useState('');
  const run = useAction();
  const refresh = useRefreshSandbox();
  const id = `topup-${account.accountId}`;

  async function submit() {
    const value = parseAmount(amount);
    if (value === null) return;
    const done = await run(() => topUp(account.accountId, value), `Topped up ${account.accountName} by ${formatMoney(value)}`);
    if (done !== undefined) setAmount('');
    await refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Top-up amount for {account.accountNumber}
      </label>
      <Input
        id={id}
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        className="w-28"
      />
      <Button variant="success" disabled={parseAmount(amount) === null} onClick={submit}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Top up
      </Button>
    </div>
  );
}

function TransferForm({ accounts }: { accounts: AccountWithBalance[] }) {
  const [form, setForm] = useState({ from: '', to: '', amount: '', reference: '' });
  const run = useAction();
  const refresh = useRefreshSandbox();
  const problem = transferError(form);

  async function submit() {
    const amount = parseAmount(form.amount);
    if (problem || amount === null) return;
    const done = await run(
      () => transfer(form.from, form.to, amount, form.reference || 'Transfer'),
      `Transferred ${formatMoney(amount)}`,
    );
    if (done !== undefined) setForm(f => ({ ...f, amount: '' }));
    await refresh();
  }

  const options = accounts.map(a => (
    <option key={a.accountId} value={a.accountId}>
      {a.accountName} ({a.accountNumber})
    </option>
  ));

  return (
    <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Transfer between accounts</h3>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-end">
        <Field label="From" htmlFor="transfer-from">
          <Select id="transfer-from" value={form.from} onChange={e => setForm({ ...form, from: e.target.value })}>
            <option value="">Select account</option>
            {options}
          </Select>
        </Field>
        <Field label="To" htmlFor="transfer-to">
          <Select id="transfer-to" value={form.to} onChange={e => setForm({ ...form, to: e.target.value })}>
            <option value="">Select account</option>
            {options}
          </Select>
        </Field>
        <Field label="Amount (R)" htmlFor="transfer-amount">
          <Input
            id="transfer-amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
          />
        </Field>
        <Field label="Reference" htmlFor="transfer-reference">
          <Input
            id="transfer-reference"
            placeholder="Transfer"
            value={form.reference}
            onChange={e => setForm({ ...form, reference: e.target.value })}
          />
        </Field>
        <Button variant="dark" disabled={problem !== null} title={problem ?? undefined} onClick={submit}>
          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
          Transfer
        </Button>
      </div>
    </div>
  );
}

export default function AccountsPanel() {
  const { data, error, isLoading, mutate } = useAccountsOverview();
  const accounts = data?.accounts ?? [];

  return (
    <Panel
      id="accounts"
      title="Accounts"
      description="Available = balance plus overdraft, less pending card holds."
      actions={
        <Button variant="secondary" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      {isLoading && <LoadingState message="Loading accounts..." />}
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {data && accounts.length === 0 && (
        <EmptyState>No accounts yet. Load a scenario or reset the data above.</EmptyState>
      )}
      {accounts.length > 0 && (
        <>
          <Table
            head={
              <>
                <Th>Name</Th>
                <Th>Product</Th>
                <Th>Account number</Th>
                <Th align="right">Balance</Th>
                <Th align="right">Available</Th>
                <Th>Top up</Th>
              </>
            }
          >
            {accounts.map(account => (
              <tr key={account.accountId}>
                <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{account.accountName}</td>
                <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{account.productName}</td>
                <td className="py-2 pr-4 font-mono text-gray-600 dark:text-gray-300">{account.accountNumber}</td>
                <td
                  className={`whitespace-nowrap py-2 pr-4 text-right font-semibold ${
                    account.currentBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {formatMoney(account.currentBalance)}
                </td>
                <td className="whitespace-nowrap py-2 pr-4 text-right text-gray-600 dark:text-gray-300">
                  {formatMoney(account.availableBalance)}
                </td>
                <td className="py-2 pr-4">
                  <TopUp account={account} />
                </td>
              </tr>
            ))}
          </Table>
          {accounts.length > 1 && <TransferForm accounts={accounts} />}
        </>
      )}
    </Panel>
  );
}
