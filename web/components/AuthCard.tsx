import Image from 'next/image';
import type { ReactNode } from 'react';

// The centred card used by the simulated bank's sign-in and consent screens.
export default function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <Image src="/sandbox.svg" alt="" width={40} height={40} className="mx-auto h-10 w-auto" />
        <h1 className="mt-8 text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h1>
      </div>
      <div className="mx-auto mt-8 w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
        {children}
      </div>
      {footer && <p className="mx-auto mt-6 max-w-sm text-center text-xs text-gray-500 dark:text-gray-400">{footer}</p>}
    </div>
  );
}
