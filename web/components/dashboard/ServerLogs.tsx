'use client';

import { useEffect, useRef } from 'react';
import { Eraser } from 'lucide-react';
import { Button, Panel } from '@/components/ui';

export default function ServerLogs({
  logs,
  connected,
  onClear,
}: {
  logs: string[];
  connected: boolean;
  onClear: () => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [logs]);

  return (
    <Panel
      id="logs"
      title="Server logs"
      description={
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-400'}`}
            aria-hidden="true"
          />
          {connected ? 'Live: every API request appears here.' : 'Connecting to the sandbox API...'}
        </span>
      }
      actions={
        <Button variant="secondary" onClick={onClear} disabled={logs.length === 0}>
          <Eraser className="h-4 w-4" aria-hidden="true" />
          Clear
        </Button>
      }
    >
      <div className="h-72 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 font-mono text-xs dark:border-gray-700 dark:bg-gray-900">
        {logs.length === 0 ? (
          <p className="px-3 py-2 text-gray-500 dark:text-gray-400">No requests yet. Send one to see it here.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {logs.map((line, i) => (
              <li key={i} className="px-3 py-1.5 text-gray-800 dark:text-gray-200">
                {line}
              </li>
            ))}
          </ul>
        )}
        <div ref={bottom} />
      </div>
    </Panel>
  );
}
