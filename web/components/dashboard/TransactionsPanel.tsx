'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, EmptyState, Field, Panel, Select, Table, Th } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useAccountsOverview, useTransactions } from '@/hooks/useSandbox';
import type { Transaction } from '@/lib/api/types';
import { PERIODS, type PeriodId, TRANSACTION_TYPES, formatMoney, periodRange, signedAmount } from '@/lib/banking';

function Row({ transaction }: { transaction: Transaction }) {
  const pending = transaction.status === 'PENDING';
  const amount = signedAmount(transaction);
  return (
    <tr>
      <td className="whitespace-nowrap py-2 pr-4 text-gray-600 dark:text-gray-300">
        {pending ? (
          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Pending
          </span>
        ) : (
          transaction.postingDate
        )}
      </td>
      <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{transaction.description}</td>
      <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{transaction.transactionType}</td>
      <td
        className={`whitespace-nowrap py-2 pr-4 text-right font-semibold ${
          amount < 0 ? 'text-gray-900 dark:text-white' : 'text-emerald-700 dark:text-emerald-400'
        }`}
      >
        {amount > 0 ? '+' : ''}
        {formatMoney(amount)}
      </td>
      <td className="whitespace-nowrap py-2 pr-4 text-right text-gray-600 dark:text-gray-300">
        {pending ? '–' : formatMoney(transaction.runningBalance)}
      </td>
    </tr>
  );
}

export default function TransactionsPanel() {
  const { data: overview } = useAccountsOverview();
  const accounts = overview?.accounts ?? [];
  const [chosenAccount, setChosenAccount] = useState('');
  const [period, setPeriod] = useState<PeriodId>('all');
  const [transactionType, setTransactionType] = useState('');
  const [includePending, setIncludePending] = useState(true);

  // Until one is picked, show the first account.
  const accountId = chosenAccount || accounts[0]?.accountId || null;
  // The date range is fixed per period choice, so the SWR key stays stable.
  const filters = useMemo(
    () => ({ ...periodRange(period), transactionType: transactionType || undefined, includePending }),
    [period, transactionType, includePending],
  );
  const { data: transactions, error, isLoading, mutate } = useTransactions(accountId, filters);

  return (
    <Panel
      id="transactions"
      title="Transactions"
      description="An account's history as the API returns it: newest first, pending holds on top."
      actions={
        <Button variant="secondary" onClick={() => mutate()} disabled={!accountId}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      {accounts.length === 0 ? (
        <EmptyState>No accounts yet. Load a scenario or reset the data above.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4">
            <Field label="Account" htmlFor="history-account">
              <Select id="history-account" value={accountId ?? ''} onChange={e => setChosenAccount(e.target.value)}>
                {accounts.map(a => (
                  <option key={a.accountId} value={a.accountId}>
                    {a.accountName} ({a.accountNumber})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Period" htmlFor="history-period">
              <Select id="history-period" value={period} onChange={e => setPeriod(e.target.value as PeriodId)}>
                {PERIODS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type" htmlFor="history-type">
              <Select id="history-type" value={transactionType} onChange={e => setTransactionType(e.target.value)}>
                <option value="">All types</option>
                {TRANSACTION_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600 sm:pb-2 dark:text-gray-300">
              <input
                type="checkbox"
                checked={includePending}
                onChange={e => setIncludePending(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Include pending holds
            </label>
          </div>
          <div className="mt-4">
            {isLoading && <LoadingState message="Loading transactions..." />}
            {error && <ErrorState error={error} onRetry={() => mutate()} />}
            {transactions && transactions.length === 0 && (
              <EmptyState>No transactions match these filters.</EmptyState>
            )}
            {transactions && transactions.length > 0 && (
              <>
                <Table
                  head={
                    <>
                      <Th>Posted</Th>
                      <Th>Description</Th>
                      <Th>Type</Th>
                      <Th align="right">Amount</Th>
                      <Th align="right">Balance</Th>
                    </>
                  }
                >
                  {transactions.map((transaction, i) => (
                    <Row key={`${transaction.postedOrder}-${transaction.transactionDate}-${i}`} transaction={transaction} />
                  ))}
                </Table>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
                </p>
              </>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
