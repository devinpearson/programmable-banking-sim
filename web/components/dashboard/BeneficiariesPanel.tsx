'use client';

import { useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import Disclosure from '@/components/Disclosure';
import { Button, EmptyState, Field, Input, Panel, Select, Table, Th } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useAction } from '@/components/ToastProvider';
import { useAccountsOverview, useBeneficiaries, useBeneficiaryCategories, useRefreshSandbox } from '@/hooks/useSandbox';
import { payBeneficiary } from '@/lib/api/sandbox';
import type { AccountWithBalance, Beneficiary } from '@/lib/api/types';
import { formatMoney, parseAmount, paymentError, referenceSuffix } from '@/lib/banking';

function PayForm({ accounts, beneficiaries }: { accounts: AccountWithBalance[]; beneficiaries: Beneficiary[] }) {
  const [form, setForm] = useState({ from: '', beneficiaryId: '', amount: '', myReference: '', theirReference: '' });
  const run = useAction();
  const refresh = useRefreshSandbox();
  const problem = paymentError(form);
  const from = accounts.find(a => a.accountId === form.from);

  async function submit() {
    const amount = parseAmount(form.amount);
    if (problem || amount === null) return;
    const beneficiary = beneficiaries.find(b => b.beneficiaryId === form.beneficiaryId);
    const done = await run(
      () =>
        payBeneficiary(form.from, {
          beneficiaryId: form.beneficiaryId,
          amount,
          myReference: form.myReference || `Payment to ${beneficiary?.beneficiaryName ?? 'beneficiary'}`,
          theirReference: form.theirReference || 'Payment',
        }),
      result => `Paid ${formatMoney(amount)} to ${beneficiary?.beneficiaryName ?? 'beneficiary'}${referenceSuffix(result)}`,
    );
    if (done !== undefined) setForm(f => ({ ...f, amount: '', myReference: '', theirReference: '' }));
    await refresh();
  }

  return (
    <Disclosure id="pay-beneficiary" title="Pay a beneficiary">
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end lg:grid-cols-6">
        <div>
          <Field label="From account" htmlFor="pay-from">
            <Select id="pay-from" value={form.from} onChange={e => setForm({ ...form, from: e.target.value })}>
              <option value="">Select account</option>
              {accounts.map(a => (
                <option key={a.accountId} value={a.accountId}>
                  {a.accountName} ({a.accountNumber})
                </option>
              ))}
            </Select>
          </Field>
          {from && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Available {formatMoney(from.availableBalance)}</p>
          )}
        </div>
        <Field label="Beneficiary" htmlFor="pay-beneficiary">
          <Select
            id="pay-beneficiary"
            value={form.beneficiaryId}
            onChange={e => setForm({ ...form, beneficiaryId: e.target.value })}
          >
            <option value="">Select beneficiary</option>
            {beneficiaries.map(b => (
              <option key={b.beneficiaryId} value={b.beneficiaryId}>
                {b.beneficiaryName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount (R)" htmlFor="pay-amount">
          <Input
            id="pay-amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
          />
        </Field>
        <Field label="My reference" htmlFor="pay-my-reference">
          <Input
            id="pay-my-reference"
            placeholder="Shown on your statement"
            value={form.myReference}
            onChange={e => setForm({ ...form, myReference: e.target.value })}
          />
        </Field>
        <Field label="Their reference" htmlFor="pay-their-reference">
          <Input
            id="pay-their-reference"
            placeholder="Shown to them"
            value={form.theirReference}
            onChange={e => setForm({ ...form, theirReference: e.target.value })}
          />
        </Field>
        <Button variant="dark" disabled={problem !== null} title={problem ?? undefined} onClick={submit}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Pay
        </Button>
      </div>
    </Disclosure>
  );
}

export default function BeneficiariesPanel() {
  const { data: beneficiaries, error, isLoading, mutate } = useBeneficiaries();
  const { data: categories = [] } = useBeneficiaryCategories();
  const { data: overview } = useAccountsOverview();
  const accounts = overview?.accounts ?? [];
  const categoryName = (id: string) => categories.find(c => c.categoryId === id)?.name ?? '–';

  return (
    <Panel
      id="beneficiaries"
      title="Beneficiaries"
      description="The people and businesses on the profile, and their last payment. Payments post straight away."
      actions={
        <Button variant="secondary" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      {isLoading && <LoadingState message="Loading beneficiaries..." />}
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {beneficiaries && beneficiaries.length === 0 && (
        <EmptyState>No beneficiaries yet. Load the Hackathon scenario or reset the data above.</EmptyState>
      )}
      {beneficiaries && beneficiaries.length > 0 && (
        <>
          <Table
            head={
              <>
                <Th>Name</Th>
                <Th>Bank</Th>
                <Th>Account</Th>
                <Th>Category</Th>
                <Th align="right">Last payment</Th>
              </>
            }
          >
            {beneficiaries.map(b => (
              <tr key={b.beneficiaryId}>
                <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{b.beneficiaryName}</td>
                <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{b.bank}</td>
                <td className="py-2 pr-4 font-mono text-gray-600 dark:text-gray-300">{b.accountNumber}</td>
                <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{categoryName(b.categoryId)}</td>
                <td className="whitespace-nowrap py-2 pr-4 text-right text-gray-600 dark:text-gray-300">
                  {b.lastPaymentAmount ? (
                    <>
                      R {b.lastPaymentAmount}
                      {b.lastPaymentDate && <span className="block text-xs">{b.lastPaymentDate}</span>}
                    </>
                  ) : (
                    '–'
                  )}
                </td>
              </tr>
            ))}
          </Table>
          {accounts.length > 0 && <PayForm accounts={accounts} beneficiaries={beneficiaries} />}
        </>
      )}
    </Panel>
  );
}
