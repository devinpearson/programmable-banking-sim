'use client';

import { CheckCircle2, X, XCircle } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';

interface Toast {
  message: string;
  error: boolean;
}

type Notify = (message: string, options?: { error?: boolean }) => void;

const ToastContext = createContext<Notify>(() => {});

// A single status message at the top of the page, cleared after a few seconds.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback<Notify>((message, options) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, error: options?.error ?? false });
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {toast && (
        <div
          role={toast.error ? 'alert' : 'status'}
          className={`fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(36rem,calc(100%-2rem))] items-start gap-3 rounded-lg p-4 shadow-lg ring-1 ${
            toast.error
              ? 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-900'
              : 'bg-green-50 text-green-800 ring-green-200 dark:bg-green-950 dark:text-green-200 dark:ring-green-900'
          }`}
        >
          {toast.error ? <XCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="shrink-0 opacity-70 hover:opacity-100">
            <span className="sr-only">Dismiss</span>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): Notify {
  return useContext(ToastContext);
}

// Run an action, then report success or the API's error message.
export function useAction() {
  const notify = useToast();
  return async function run<T>(action: () => Promise<T>, success: string | ((value: T) => string)) {
    try {
      const value = await action();
      notify(typeof success === 'function' ? success(value) : success);
      return value;
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), { error: true });
      return undefined;
    }
  };
}
