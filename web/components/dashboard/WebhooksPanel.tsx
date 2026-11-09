'use client';

import { useState } from 'react';
import { Pause, Play, Plus, Send, Trash2 } from 'lucide-react';
import { Button, EmptyState, Field, Input, Panel, Table, Th } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useAction } from '@/components/ToastProvider';
import { useWebhookDeliveries, useWebhookEvents, useWebhooks } from '@/hooks/useSandbox';
import { createWebhook, deleteWebhook, setWebhookActive, testWebhook } from '@/lib/api/sandbox';
import type { Webhook, WebhookDelivery } from '@/lib/api/types';

function RegisterForm({ events, onRegistered }: { events: string[]; onRegistered: (webhook: Webhook) => void }) {
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  // None ticked means every event.
  const [chosen, setChosen] = useState<string[]>([]);
  const run = useAction();

  async function submit() {
    if (!url.trim()) return;
    const webhook = await run(
      () =>
        createWebhook({
          url: url.trim(),
          ...(chosen.length > 0 ? { events: chosen } : {}),
          ...(secret ? { secret } : {}),
        }),
      created => `Webhook registered for ${created.url}`,
    );
    if (webhook) {
      setUrl('');
      setSecret('');
      setChosen([]);
      onRegistered(webhook);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Field label="URL" htmlFor="webhook-url">
            <Input
              id="webhook-url"
              type="url"
              placeholder="http://localhost:8080/webhooks/sandbox"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Signing secret (optional)" htmlFor="webhook-secret">
          <Input
            id="webhook-secret"
            type="password"
            autoComplete="off"
            placeholder="At least 8 characters"
            value={secret}
            onChange={e => setSecret(e.target.value)}
          />
        </Field>
        <Button variant="dark" disabled={!url.trim()} onClick={submit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Register webhook
        </Button>
      </div>
      <fieldset>
        <legend className="text-xs font-medium text-gray-600 dark:text-gray-300">Events (none ticked = all)</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {events.map(event => (
            <label key={event} className="flex items-center gap-1.5 font-mono text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={chosen.includes(event)}
                onChange={() => setChosen(c => (c.includes(event) ? c.filter(e => e !== event) : [...c, event]))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              {event}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function StatusBadge({ delivery }: { delivery: WebhookDelivery }) {
  const ok = delivery.status === 'delivered';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
        ok
          ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
          : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
      }`}
    >
      {ok ? `Delivered${delivery.responseStatus ? ` (${delivery.responseStatus})` : ''}` : 'Failed'}
    </span>
  );
}

function Deliveries({ webhook }: { webhook: Webhook }) {
  const { data: deliveries, isLoading } = useWebhookDeliveries(webhook.webhookId);
  if (isLoading) return <LoadingState message="Loading deliveries..." />;
  if (!deliveries || deliveries.length === 0) {
    return <EmptyState>No deliveries yet. Send a test, or swipe a card or top up an account.</EmptyState>;
  }
  return (
    <Table
      head={
        <>
          <Th>Time</Th>
          <Th>Event</Th>
          <Th>Result</Th>
          <Th align="right">Took</Th>
          <Th>Payload</Th>
        </>
      }
    >
      {deliveries.map(delivery => (
        <tr key={delivery.deliveryId} className="align-top">
          <td className="whitespace-nowrap py-2 pr-4 text-gray-600 dark:text-gray-300">
            {new Date(delivery.createdAt).toLocaleTimeString()}
          </td>
          <td className="py-2 pr-4 font-mono text-xs text-gray-900 dark:text-gray-100">{delivery.event}</td>
          <td className="py-2 pr-4">
            <StatusBadge delivery={delivery} />
            {delivery.error && <span className="block text-xs text-red-700 dark:text-red-400">{delivery.error}</span>}
          </td>
          <td className="whitespace-nowrap py-2 pr-4 text-right text-gray-600 dark:text-gray-300">{delivery.durationMs} ms</td>
          <td className="py-2 pr-4">
            <details>
              <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">Show</summary>
              <pre className="mt-1 max-w-md overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                {JSON.stringify(delivery.payload, null, 2)}
              </pre>
            </details>
          </td>
        </tr>
      ))}
    </Table>
  );
}

export default function WebhooksPanel() {
  const { data: webhooks, error, isLoading, mutate } = useWebhooks();
  const { data: events = [] } = useWebhookEvents();
  const [selected, setSelected] = useState<string | null>(null);
  const run = useAction();
  // Show the chosen webhook's deliveries, or the first one's.
  const shown = webhooks?.find(w => w.webhookId === selected) ?? webhooks?.[0] ?? null;

  async function act<T>(action: () => Promise<T>, success: string) {
    await run(action, success);
    await mutate();
  }

  return (
    <Panel
      id="webhooks"
      title="Webhooks"
      description="The sandbox POSTs events to these URLs: transactions posting, card holds and reversals, and every card authorization."
    >
      <RegisterForm events={events} onRegistered={webhook => { setSelected(webhook.webhookId); void mutate(); }} />
      <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-700">
        {isLoading && <LoadingState message="Loading webhooks..." />}
        {error && <ErrorState error={error} onRetry={() => mutate()} />}
        {webhooks && webhooks.length === 0 && <EmptyState>No webhooks registered.</EmptyState>}
        {webhooks && webhooks.length > 0 && (
          <Table
            head={
              <>
                <Th>URL</Th>
                <Th>Events</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </>
            }
          >
            {webhooks.map(webhook => (
              <tr
                key={webhook.webhookId}
                className={shown?.webhookId === webhook.webhookId ? 'bg-blue-50/50 dark:bg-blue-950/30' : ''}
              >
                <td className="py-2 pr-4">
                  <button
                    type="button"
                    onClick={() => setSelected(webhook.webhookId)}
                    className="break-all text-left font-mono text-xs text-gray-900 hover:text-blue-600 dark:text-gray-100"
                  >
                    {webhook.url}
                  </button>
                  {webhook.hasSecret && <span className="block text-xs text-gray-500 dark:text-gray-400">Signed</span>}
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-gray-600 dark:text-gray-300">
                  {webhook.events.includes('*') ? 'All events' : webhook.events.join(', ')}
                </td>
                <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{webhook.active ? 'Active' : 'Paused'}</td>
                <td className="py-2 pr-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelected(webhook.webhookId);
                        void act(() => testWebhook(webhook.webhookId), `Test event sent to ${webhook.url}`);
                      }}
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Send test
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        act(
                          () => setWebhookActive(webhook.webhookId, !webhook.active),
                          webhook.active ? 'Webhook paused' : 'Webhook resumed',
                        )
                      }
                    >
                      {webhook.active ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                      {webhook.active ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      variant="secondary"
                      aria-label={`Delete webhook ${webhook.url}`}
                      onClick={() => {
                        if (window.confirm(`Delete the webhook for ${webhook.url} and its delivery log?`)) {
                          void act(() => deleteWebhook(webhook.webhookId), 'Webhook deleted');
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      {shown && (
        <section aria-labelledby="webhook-deliveries-title" className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-700">
          <h3 id="webhook-deliveries-title" className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
            Recent deliveries to <span className="break-all font-mono text-xs">{shown.url}</span>
          </h3>
          <Deliveries webhook={shown} />
        </section>
      )}
    </Panel>
  );
}
