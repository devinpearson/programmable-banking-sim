'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

const storageKey = (id: string) => `sandbox-open-${id}`;

/**
 * A part of a panel that stays folded until it's needed, such as a form.
 * Whether it's open is remembered per browser.
 */
export default function Disclosure({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(storageKey(id)) === 'true');
    } catch {
      // Storage blocked: start folded.
    }
  }, [id]);

  function remember(next: boolean) {
    setOpen(next);
    try {
      localStorage.setItem(storageKey(id), String(next));
    } catch {
      // Storage blocked: only this visit remembers.
    }
  }

  return (
    <details
      open={open}
      onToggle={e => {
        const next = e.currentTarget.open;
        if (next !== open) remember(next);
      }}
      className="group mt-6 border-t border-gray-100 pt-4 dark:border-gray-700"
    >
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
        {title}
      </summary>
      {children}
    </details>
  );
}
