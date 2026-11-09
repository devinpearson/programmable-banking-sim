import { AlertCircle, Loader2 } from 'lucide-react';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-gray-600 dark:text-gray-300">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" aria-hidden="true" />
      {message}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 py-4 text-sm text-red-700 dark:text-red-400">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <span>
        Could not reach the sandbox API: {message}. Is it running (<code>npm run dev</code>)?
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-medium underline">
          Try again
        </button>
      )}
    </div>
  );
}
