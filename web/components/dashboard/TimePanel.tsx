'use client';

import { useState } from 'react';
import { CalendarClock, FastForward, Pause, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import Disclosure from '@/components/Disclosure';
import { Button, EmptyState, Field, Input, Panel, Select, Table, Th } from '@/components/ui';
import { useAction } from '@/components/ToastProvider';
import { useAccountsOverview, useClock, useRefreshSandbox, useSchedules } from '@/hooks/useSandbox';
import {
  advanceClock,
  createSchedule,
  deleteSchedule,
  type NewSchedule,
  resetClock,
  setScheduleActive,
} from '@/lib/api/sandbox';
import type { Schedule } from '@/lib/api/types';
import { accountLabel, daysToNextMonth, describeAdvance, describeFrequency, formatMoney, parseAmount } from '@/lib/banking';

// Shown at the top of the dashboard while the sandbox date isn't today.
export function ClockBanner() {
  const { data: clock, mutate } = useClock();
  const run = useAction();
  const refresh = useRefreshSandbox();
  if (!clock || clock.offsetDays === 0) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
    >
      <CalendarClock className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        <span className="font-semibold">Sandbox date: {clock.today}</span> ({clock.offsetDays} day
        {clock.offsetDays === 1 ? '' : 's'} ahead of today).
      </p>
      <Button
        variant="secondary"
        onClick={async () => {
          await run(resetClock, 'Back to the real date');
          await Promise.all([mutate(), refresh()]);
        }}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Back to today
      </Button>
    </div>
  );
}

function amountLabel(schedule: Schedule) {
  if (schedule.kind === 'interest') return `${schedule.annualRatePercent}% a year`;
  const sign = schedule.type === 'DEBIT' ? '-' : '+';
  return `${sign}${formatMoney(schedule.amount)}`;
}

type Kind = 'CREDIT' | 'DEBIT' | 'interest';

function AddScheduleForm({ onAdded }: { onAdded: () => void }) {
  const { data: overview } = useAccountsOverview();
  const accounts = overview?.accounts ?? [];
  const [form, setForm] = useState({
    accountId: '',
    description: '',
    kind: 'CREDIT' as Kind,
    value: '',
    frequency: 'monthly' as 'monthly' | 'weekly',
    day: '25',
  });
  const run = useAction();
  const value = parseAmount(form.value);
  const ready = form.accountId && form.description.trim() && value !== null;

  async function submit() {
    if (!ready || value === null) return;
    const interest = form.kind === 'interest';
    const schedule: NewSchedule = {
      accountId: form.accountId,
      description: form.description.trim(),
      kind: interest ? 'interest' : 'fixed',
      ...(interest ? { annualRatePercent: value } : { type: form.kind as 'CREDIT' | 'DEBIT', amount: value }),
      frequency: form.frequency,
      ...(form.frequency === 'monthly' ? { dayOfMonth: Number(form.day) } : { dayOfWeek: Number(form.day) }),
    };
    const created = await run(() => createSchedule(schedule), s => `${s.description}: first run on ${s.nextRunDate}`);
    if (created) setForm(f => ({ ...f, description: '', value: '' }));
    onAdded();
  }

  return (
    <Disclosure id="add-schedule" title="Add a recurring transaction">
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end lg:grid-cols-7">
        <Field label="Account" htmlFor="schedule-account">
          <Select id="schedule-account" value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })}>
            <option value="">Select account</option>
            {accounts.map(a => (
              <option key={a.accountId} value={a.accountId}>
                {a.accountName} ({a.accountNumber})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" htmlFor="schedule-description">
          <Input
            id="schedule-description"
            placeholder="Salary"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label="Kind" htmlFor="schedule-kind">
          <Select id="schedule-kind" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as Kind })}>
            <option value="CREDIT">Money in (e.g. salary)</option>
            <option value="DEBIT">Money out (e.g. debit order)</option>
            <option value="interest">Interest</option>
          </Select>
        </Field>
        <Field label={form.kind === 'interest' ? 'Annual rate (%)' : 'Amount (R)'} htmlFor="schedule-value">
          <Input
            id="schedule-value"
            type="number"
            min="0"
            step="0.01"
            value={form.value}
            onChange={e => setForm({ ...form, value: e.target.value })}
          />
        </Field>
        <Field label="Repeats" htmlFor="schedule-frequency">
          <Select
            id="schedule-frequency"
            value={form.frequency}
            onChange={e => {
              const frequency = e.target.value as 'monthly' | 'weekly';
              setForm({ ...form, frequency, day: frequency === 'monthly' ? '25' : '1' });
            }}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </Select>
        </Field>
        <Field label={form.frequency === 'monthly' ? 'Day of month' : 'Weekday'} htmlFor="schedule-day">
          <Select id="schedule-day" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>
            {form.frequency === 'monthly'
              ? Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1 === 31 ? 'Last day' : i + 1}
                  </option>
                ))
              : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
          </Select>
        </Field>
        <Button variant="dark" disabled={!ready} onClick={submit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add
        </Button>
      </div>
    </Disclosure>
  );
}

export default function TimePanel() {
  const { data: clock, mutate: mutateClock } = useClock();
  const { data: schedules, mutate: mutateSchedules } = useSchedules();
  const { data: overview } = useAccountsOverview();
  const accounts = overview?.accounts ?? [];
  const run = useAction();
  const refresh = useRefreshSandbox();

  async function advance(days: number) {
    await run(() => advanceClock(days), describeAdvance);
    await Promise.all([mutateClock(), refresh()]);
  }

  return (
    <Panel
      id="time"
      title="Time and recurring transactions"
      description="Move the sandbox date forward: recurring transactions post on their dates and card holds settle after three days. Real days count too."
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Sandbox date <span className="font-semibold text-gray-900 dark:text-white">{clock?.today ?? '…'}</span>
          {clock && clock.offsetDays > 0 && <> ({clock.offsetDays} days ahead)</>}
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: '+1 day', days: 1 },
            { label: '+1 week', days: 7 },
          ].map(b => (
            <Button key={b.label} variant="secondary" disabled={!clock} onClick={() => advance(b.days)}>
              <FastForward className="h-4 w-4" aria-hidden="true" />
              {b.label}
            </Button>
          ))}
          <Button variant="secondary" disabled={!clock} onClick={() => clock && advance(daysToNextMonth(clock.today))}>
            <FastForward className="h-4 w-4" aria-hidden="true" />
            +1 month
          </Button>
        </div>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-700">
        {!schedules || schedules.length === 0 ? (
          <EmptyState>No recurring transactions. Add one below, or load a scenario (they come with salary, debit orders and interest).</EmptyState>
        ) : (
          <Table
            head={
              <>
                <Th>Description</Th>
                <Th>Account</Th>
                <Th align="right">Amount</Th>
                <Th>Repeats</Th>
                <Th>Next run</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </>
            }
          >
            {schedules.map(schedule => (
              <tr key={schedule.scheduleId} className={schedule.active ? '' : 'opacity-60'}>
                <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{schedule.description}</td>
                <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{accountLabel(accounts, schedule.accountId)}</td>
                <td className="whitespace-nowrap py-2 pr-4 text-right text-gray-900 dark:text-white">{amountLabel(schedule)}</td>
                <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{describeFrequency(schedule)}</td>
                <td className="whitespace-nowrap py-2 pr-4 text-gray-600 dark:text-gray-300">
                  {schedule.active ? schedule.nextRunDate : 'Paused'}
                </td>
                <td className="py-2 pr-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        await run(
                          () => setScheduleActive(schedule.scheduleId, !schedule.active),
                          `${schedule.description} ${schedule.active ? 'paused' : 'resumed'}`,
                        );
                        await mutateSchedules();
                      }}
                    >
                      {schedule.active ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                      {schedule.active ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      variant="secondary"
                      aria-label={`Delete ${schedule.description}`}
                      onClick={async () => {
                        await run(() => deleteSchedule(schedule.scheduleId), `${schedule.description} deleted`);
                        await mutateSchedules();
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
      <AddScheduleForm onAdded={() => void mutateSchedules()} />
    </Panel>
  );
}
