'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Save } from 'lucide-react';
import { Button, Field, Input, Panel, Select } from '@/components/ui';
import { useAction } from '@/components/ToastProvider';
import { useSettings } from '@/hooks/useSandbox';
import { saveSettings } from '@/lib/api/sandbox';
import type { Settings } from '@/lib/api/types';

interface Form {
  client_id: string;
  client_secret: string;
  api_key: string;
  token_expiry: string;
  auth: boolean;
}

function toForm(settings: Settings): Form {
  return {
    client_id: settings.client_id ?? '',
    client_secret: settings.client_secret ?? '',
    api_key: settings.api_key ?? '',
    token_expiry: String(settings.token_expiry ?? 1799),
    auth: settings.auth,
  };
}

function SecretInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete="off"
      />
      <Button variant="secondary" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Hide' : 'Show'}>
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function SettingsPanel() {
  const { data, mutate } = useSettings();
  const [form, setForm] = useState<Form | null>(null);
  const run = useAction();

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  async function save() {
    if (!form) return;
    await run(
      () => saveSettings({ ...form, token_expiry: Number(form.token_expiry) || 1799 }),
      'Settings saved',
    );
    await mutate();
  }

  return (
    <Panel
      id="settings"
      title="Settings"
      description="The credentials the sandbox accepts, and whether API calls need an access token."
    >
      {!form ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading settings...</p>
      ) : (
        <form
          className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={e => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Client ID" htmlFor="client_id">
            <Input id="client_id" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} />
          </Field>
          <Field label="Client secret" htmlFor="client_secret">
            <SecretInput id="client_secret" value={form.client_secret} onChange={v => setForm({ ...form, client_secret: v })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="API key" htmlFor="api_key">
              <SecretInput id="api_key" value={form.api_key} onChange={v => setForm({ ...form, api_key: v })} />
            </Field>
          </div>
          <Field label="Token expiry (seconds)" htmlFor="token_expiry">
            <Input
              id="token_expiry"
              type="number"
              min="1"
              value={form.token_expiry}
              onChange={e => setForm({ ...form, token_expiry: e.target.value })}
            />
          </Field>
          <Field label="Require authentication" htmlFor="auth">
            <Select id="auth" value={form.auth ? 'yes' : 'no'} onChange={e => setForm({ ...form, auth: e.target.value === 'yes' })}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </Select>
          </Field>
          {form.auth && (
            <p className="text-xs text-amber-700 sm:col-span-2 dark:text-amber-400">
              With authentication on, API calls need a bearer token, including this dashboard&apos;s own requests.
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" variant="dark">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save settings
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}
