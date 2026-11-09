'use client';

import { Check, Undo2 } from 'lucide-react';
import { Button, EmptyState, Panel, Table, Th } from '@/components/ui';
import { useAction } from '@/components/ToastProvider';
import { useAccountsOverview, useRefreshSandbox } from '@/hooks/useSandbox';
import { reverseHold, settleHold } from '@/lib/api/sandbox';
import type { PendingTransaction } from '@/lib/api/types';
import { accountLabel, formatMoney } from '@/lib/banking';

export default function PendingHoldsPanel() {
  const { data } = useAccountsOverview();
  const run = useAction();
  const refresh = useRefreshSandbox();
  const holds = data?.pendingHolds ?? [];
  const accounts = data?.accounts ?? [];

  async function act(action: (hold: PendingTransaction) => Promise<unknown>, hold: PendingTransaction, verb: string) {
    await run(() => action(hold), `${verb} ${hold.description} (${formatMoney(hold.amount)})`);
    await refresh();
  }

  return (
    <Panel
      id="holds"
      title="Pending holds"
      description="Card purchases that have not settled. They reduce the available balance until they are settled (posted) or reversed."
    >
      {holds.length === 0 ? (
        <EmptyState>No pending holds. Swipe a card above to create one.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <Th>Date</Th>
              <Th>Description</Th>
              <Th>Account</Th>
              <Th align="right">Amount</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </>
          }
        >
          {holds.map(hold => (
            <tr key={hold.transactionId}>
              <td className="whitespace-nowrap py-2 pr-4 text-gray-600 dark:text-gray-300">{hold.transactionDate}</td>
              <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{hold.description}</td>
              <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{accountLabel(accounts, hold.accountId)}</td>
              <td className="whitespace-nowrap py-2 pr-4 text-right font-semibold text-gray-900 dark:text-white">
                {formatMoney(hold.amount)}
              </td>
              <td className="py-2 pr-4">
                <div className="flex justify-end gap-2">
                  <Button variant="success" onClick={() => act(settleHold, hold, 'Settled')}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Settle
                  </Button>
                  <Button variant="secondary" onClick={() => act(reverseHold, hold, 'Reversed')}>
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    Reverse
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  );
}
