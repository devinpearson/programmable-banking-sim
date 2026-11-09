'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowLeftRight, CreditCard, Landmark, Users } from 'lucide-react';
import { useSummary } from '@/hooks/useSandbox';

function MetricCard({ title, value, icon: Icon }: { title: string; value: number | string; icon: LucideIcon }) {
  return (
    <div className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div>
        <p className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
      <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
    </div>
  );
}

export default function SummaryCards() {
  const { data } = useSummary();
  const value = (n: number | undefined) => (n === undefined ? '–' : n);
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard title="Profiles" value={value(data?.profiles)} icon={Users} />
      <MetricCard title="Accounts" value={value(data?.accounts)} icon={Landmark} />
      <MetricCard title="Cards" value={value(data?.cards)} icon={CreditCard} />
      <MetricCard title="Transactions" value={value(data?.transactions)} icon={ArrowLeftRight} />
    </div>
  );
}
