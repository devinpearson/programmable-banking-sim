'use client';

import { useSummary } from '@/hooks/useSandbox';

// What's in the sandbox, in one line.
export default function SummaryCards() {
  const { data } = useSummary();
  const items = [
    { label: 'profiles', value: data?.profiles },
    { label: 'accounts', value: data?.accounts },
    { label: 'cards', value: data?.cards },
    { label: 'transactions', value: data?.transactions },
  ];
  return (
    <p aria-label="Sandbox totals" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
      {items.map(item => (
        <span key={item.label}>
          <span className="font-semibold text-gray-900 dark:text-white">{item.value ?? '–'}</span> {item.label}
        </span>
      ))}
    </p>
  );
}
