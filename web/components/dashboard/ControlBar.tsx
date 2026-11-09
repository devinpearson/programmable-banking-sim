'use client';

import { useRef, useState } from 'react';
import { DatabaseZap, Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { useAction, useToast } from '@/components/ToastProvider';
import { useRefreshSandbox, useScenarios } from '@/hooks/useSandbox';
import { clearDatabase, exportState, importState, loadScenario, resetDatabase } from '@/lib/api/sandbox';

// Save text as a file in the browser.
function download(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// Load a named scenario, or reset/clear the sandbox data.
export default function ControlBar() {
  const { data: scenarios = [] } = useScenarios();
  const [selected, setSelected] = useState('');
  const run = useAction();
  const refresh = useRefreshSandbox();
  const description = scenarios.find(s => s.id === selected)?.description;
  const fileInput = useRef<HTMLInputElement>(null);
  const notify = useToast();

  async function importFile(file: File) {
    let state: unknown;
    try {
      state = JSON.parse(await file.text());
    } catch {
      notify(`${file.name} is not valid JSON`, { error: true });
      return;
    }
    if (!window.confirm(`Replace all accounts, transactions, beneficiaries, cards and exchange rates with ${file.name}?`)) {
      return;
    }
    await act(
      () => importState(state),
      counts => `Imported ${file.name}: ${counts.accounts} accounts, ${counts.transactions} transactions, ${counts.cards} cards`,
    );
  }

  async function act<T>(action: () => Promise<T>, success: string | ((value: T) => string)) {
    await run(action, success);
    await refresh();
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <label htmlFor="scenario" className="block text-xs font-medium text-gray-600 dark:text-gray-300">
          Scenario
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <Select id="scenario" value={selected} onChange={e => setSelected(e.target.value)} className="w-56">
            <option value="">Select a scenario</option>
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button
            disabled={!selected}
            onClick={() => act(() => loadScenario(selected), value => `Loaded scenario: ${value?.name ?? selected}`)}
          >
            <DatabaseZap className="h-4 w-4" aria-hidden="true" />
            Load scenario
          </Button>
        </div>
        {description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="dark" onClick={() => act(resetDatabase, 'Sandbox reset to the seed data')}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset data
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (window.confirm('Remove all profiles, accounts, transactions, beneficiaries and cards?')) {
              void act(clearDatabase, 'Sandbox data cleared');
            }
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear data
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            run(async () => {
              const { fileName, json } = await exportState();
              download(fileName, json);
              return fileName;
            }, fileName => `Exported the sandbox to ${fileName}`)
          }
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
        </Button>
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Import
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          aria-label="Import a sandbox file"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importFile(file);
          }}
        />
      </div>
    </div>
  );
}
