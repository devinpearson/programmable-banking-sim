'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Power, Save } from 'lucide-react';
import { Button, Field, Input, Panel, Select } from '@/components/ui';
import { useAction } from '@/components/ToastProvider';
import { useFaults } from '@/hooks/useSandbox';
import { type FaultSettings, saveFaults, turnOffFaults } from '@/lib/api/sandbox';
import { describeFaults } from '@/lib/banking';

const PATHS = [
  { value: '', label: 'All /za requests and tokens' },
  { value: '/za/pb/v1/accounts', label: 'Accounts (/za/pb/v1/accounts)' },
  { value: '/za/v1/cards', label: 'Cards (/za/v1/cards)' },
  { value: '/identity/v2/oauth2/token', label: 'Token endpoint' },
];

// Shown at the top of the dashboard while faults are on.
export function FaultBanner() {
  const { data, mutate } = useFaults();
  const run = useAction();
  if (!data?.active) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
    >
      <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        <span className="font-semibold">Fault injection is on:</span> {describeFaults(data)}. The dashboard itself is
        exempt.
      </p>
      <Button
        variant="secondary"
        onClick={async () => {
          await run(turnOffFaults, 'Fault injection turned off');
          await mutate();
        }}
      >
        <Power className="h-4 w-4" aria-hidden="true" />
        Turn off
      </Button>
    </div>
  );
}

const number = (value: string) => (value === '' ? 0 : Number(value));

export default function FaultsPanel() {
  const { data, mutate } = useFaults();
  const [form, setForm] = useState<FaultSettings | null>(null);
  const run = useAction();

  useEffect(() => {
    if (data) {
      setForm({
        errorRate: data.errorRate,
        errorStatus: data.errorStatus,
        timeoutRate: data.timeoutRate,
        latencyMs: data.latencyMs,
        pathPrefix: data.pathPrefix,
      });
    }
  }, [data]);

  async function save() {
    if (!form) return;
    await run(() => saveFaults(form), saved => (saved.active ? `Faults on: ${describeFaults(saved)}` : 'Faults off'));
    await mutate();
  }

  async function off() {
    await run(turnOffFaults, 'Fault injection turned off');
    await mutate();
  }

  return (
    <Panel
      id="faults"
      title="Fault injection"
      description="Make the bank misbehave so you can test your app's error handling, retries and timeouts."
    >
      {!form ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end lg:grid-cols-6">
            <Field label="Error rate (%)" htmlFor="fault-error-rate">
              <Input
                id="fault-error-rate"
                type="number"
                min="0"
                max="100"
                value={form.errorRate}
                onChange={e => setForm({ ...form, errorRate: number(e.target.value) })}
              />
            </Field>
            <Field label="Error status" htmlFor="fault-error-status">
              <Select
                id="fault-error-status"
                value={form.errorStatus}
                onChange={e => setForm({ ...form, errorStatus: Number(e.target.value) as FaultSettings['errorStatus'] })}
              >
                <option value={429}>429 Too Many Requests</option>
                <option value={500}>500 Internal Server Error</option>
                <option value={502}>502 Bad Gateway</option>
                <option value={503}>503 Service Unavailable</option>
                <option value={504}>504 Gateway Timeout</option>
              </Select>
            </Field>
            <Field label="Timeout rate (%)" htmlFor="fault-timeout-rate">
              <Input
                id="fault-timeout-rate"
                type="number"
                min="0"
                max="100"
                value={form.timeoutRate}
                onChange={e => setForm({ ...form, timeoutRate: number(e.target.value) })}
              />
            </Field>
            <Field label="Extra latency (ms)" htmlFor="fault-latency">
              <Input
                id="fault-latency"
                type="number"
                min="0"
                max="60000"
                step="100"
                value={form.latencyMs}
                onChange={e => setForm({ ...form, latencyMs: number(e.target.value) })}
              />
            </Field>
            <Field label="Applies to" htmlFor="fault-path">
              <Select id="fault-path" value={form.pathPrefix} onChange={e => setForm({ ...form, pathPrefix: e.target.value })}>
                {PATHS.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button variant="dark" onClick={save} className="flex-1">
                <Save className="h-4 w-4" aria-hidden="true" />
                Save
              </Button>
              <Button variant="secondary" onClick={off} disabled={!data?.active}>
                <Power className="h-4 w-4" aria-hidden="true" />
                Off
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Timeouts hold the request for 30 s, then drop the connection. For a single request instead, send{' '}
            <code className="font-mono">X-Sandbox-Fault: 503</code> (or 429, 500, 502, 504,{' '}
            <code className="font-mono">timeout</code>, <code className="font-mono">timeout:2000</code>,{' '}
            <code className="font-mono">reset</code>) or <code className="font-mono">X-Sandbox-Latency: 1500</code>.
          </p>
        </div>
      )}
    </Panel>
  );
}
