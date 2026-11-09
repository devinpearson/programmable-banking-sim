'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Check } from 'lucide-react';
import AuthCard from '@/components/AuthCard';
import { Button } from '@/components/ui';
import { LoadingState } from '@/components/StateViews';
import { approveUrl, declineUrl, getConsent } from '@/lib/api/sandbox';

// The consent step of the 3-legged OAuth flow: what the app asked for, and
// which accounts the user lets it see. Approving or declining redirects back
// to the app's redirect_uri via the sandbox API.
function ConsentForm() {
  const qsp = useSearchParams().get('qsp') ?? '';
  const { data, error, isLoading } = useSWR(qsp ? ['consent', qsp] : null, () => getConsent(qsp), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(accountNumber: string) {
    setSelected(current =>
      current.includes(accountNumber) ? current.filter(n => n !== accountNumber) : [...current, accountNumber],
    );
  }

  if (!qsp || error) {
    return (
      <AuthCard title="Authorize accounts">
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          This sign-in request has expired or was not signed in. Start again from the app.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Authorize accounts"
      footer="Leave every account unticked to allow access to all of them."
    >
      {isLoading || !data ? (
        <LoadingState message="Loading the request..." />
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              By approving this request, you grant the app access to:
            </p>
            <ul className="mt-3 space-y-1.5">
              {data.scopes.map(item => (
                <li key={item.scope} className="flex items-start gap-2 text-sm font-medium text-gray-900 dark:text-white">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  {item.description}
                </li>
              ))}
            </ul>
          </div>
          <fieldset className="border-t border-gray-200 pt-4 dark:border-gray-700">
            <legend className="sr-only">Accounts</legend>
            <p className="mb-3 text-sm font-medium text-gray-900 dark:text-white">For these accounts</p>
            <div className="space-y-3">
              {data.accounts.map(account => (
                <label key={account.accountId} className="flex items-start gap-3 text-sm text-gray-900 dark:text-gray-100">
                  <input
                    type="checkbox"
                    checked={selected.includes(account.accountNumber)}
                    onChange={() => toggle(account.accountNumber)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span>
                    {account.accountName} ({account.productName})
                    <span className="block font-mono text-xs text-gray-500 dark:text-gray-400">{account.accountNumber}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => window.location.assign(declineUrl(qsp))}>
              Decline
            </Button>
            <Button className="flex-1" onClick={() => window.location.assign(approveUrl(qsp, selected))}>
              Authorize
            </Button>
          </div>
        </div>
      )}
    </AuthCard>
  );
}

export default function ConsentPage() {
  return (
    <Suspense>
      <ConsentForm />
    </Suspense>
  );
}
