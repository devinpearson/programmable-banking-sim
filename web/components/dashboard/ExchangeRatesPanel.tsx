'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button, EmptyState, Field, Input, Panel, Table, Th } from '@/components/ui';
import { useAction } from '@/components/ToastProvider';
import { useExchangeRates } from '@/hooks/useSandbox';
import { deleteExchangeRate, setExchangeRate } from '@/lib/api/sandbox';
import type { ExchangeRate } from '@/lib/api/types';
import { parseAmount } from '@/lib/banking';

function RateRow({ rate, onChanged }: { rate: ExchangeRate; onChanged: () => void }) {
  const [value, setValue] = useState(String(rate.zarPerUnit));
  const run = useAction();
  const home = rate.currencyCode === 'ZAR';
  const parsed = parseAmount(value);
  const changed = parsed !== null && parsed !== rate.zarPerUnit;

  useEffect(() => setValue(String(rate.zarPerUnit)), [rate.zarPerUnit]);

  return (
    <tr>
      <td className="py-2 pr-4 font-mono text-gray-900 dark:text-gray-100">{rate.currencyCode}</td>
      <td className="py-2 pr-4">
        {home ? (
          <span className="text-gray-600 dark:text-gray-300">1 (home currency)</span>
        ) : (
          <>
            <label htmlFor={`rate-${rate.currencyCode}`} className="sr-only">
              Rand per {rate.currencyCode}
            </label>
            <Input
              id={`rate-${rate.currencyCode}`}
              type="number"
              min="0"
              step="any"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="w-32"
            />
          </>
        )}
      </td>
      <td className="whitespace-nowrap py-2 pr-4 text-gray-600 dark:text-gray-300">
        {new Date(rate.updatedAt).toLocaleString()}
      </td>
      <td className="py-2 pr-4">
        {!home && (
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={!changed}
              onClick={async () => {
                if (parsed === null) return;
                await run(() => setExchangeRate(rate.currencyCode, parsed), `1 ${rate.currencyCode} is now R ${parsed}`);
                onChanged();
              }}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save
            </Button>
            <Button
              variant="secondary"
              aria-label={`Remove ${rate.currencyCode}`}
              onClick={async () => {
                await run(() => deleteExchangeRate(rate.currencyCode), `${rate.currencyCode} removed; swipes in it are refused`);
                onChanged();
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function ExchangeRatesPanel() {
  const { data: rates, mutate } = useExchangeRates();
  const [code, setCode] = useState('');
  const [rate, setRate] = useState('');
  const run = useAction();
  const validCode = /^[A-Za-z]{3}$/.test(code.trim()) && code.trim().toUpperCase() !== 'ZAR';
  const parsedRate = parseAmount(rate);

  async function add() {
    if (!validCode || parsedRate === null) return;
    const upper = code.trim().toUpperCase();
    const saved = await run(() => setExchangeRate(upper, parsedRate), `Added ${upper} at R ${parsedRate}`);
    if (saved) {
      setCode('');
      setRate('');
    }
    await mutate();
  }

  return (
    <Panel
      id="exchange-rates"
      title="Exchange rates"
      description="Rand per unit, used to charge foreign card swipes. Illustrative sandbox rates, not live ones."
    >
      {!rates || rates.length === 0 ? (
        <EmptyState>No exchange rates. Reset the data to restore the seeded ones.</EmptyState>
      ) : (
        <Table
          head={
            <>
              <Th>Currency</Th>
              <Th>Rand per unit</Th>
              <Th>Updated</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </>
          }
        >
          {rates.map(r => (
            <RateRow key={r.currencyCode} rate={r} onChanged={() => void mutate()} />
          ))}
        </Table>
      )}
      <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add a currency</h3>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
          <Field label="Currency code" htmlFor="new-rate-code">
            <Input id="new-rate-code" placeholder="e.g. THB" maxLength={3} value={code} onChange={e => setCode(e.target.value)} />
          </Field>
          <Field label="Rand per unit" htmlFor="new-rate-value">
            <Input
              id="new-rate-value"
              type="number"
              min="0"
              step="any"
              placeholder="0.52"
              value={rate}
              onChange={e => setRate(e.target.value)}
            />
          </Field>
          <Button variant="dark" disabled={!validCode || parsedRate === null} onClick={add}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add currency
          </Button>
        </div>
      </div>
    </Panel>
  );
}
