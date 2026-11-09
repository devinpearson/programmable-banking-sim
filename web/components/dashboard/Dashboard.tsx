'use client';

import { useLiveUpdates } from '@/hooks/useSandbox';
import AccountsPanel from './AccountsPanel';
import BeneficiariesPanel from './BeneficiariesPanel';
import CardsPanel from './CardsPanel';
import ControlBar from './ControlBar';
import PendingHoldsPanel from './PendingHoldsPanel';
import ServerLogs from './ServerLogs';
import SettingsPanel from './SettingsPanel';
import SummaryCards from './SummaryCards';
import TransactionsPanel from './TransactionsPanel';

export default function Dashboard() {
  const { logs, connected, clearLogs } = useLiveUpdates();
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <ControlBar />
      <SummaryCards />
      <AccountsPanel />
      <TransactionsPanel />
      <BeneficiariesPanel />
      <CardsPanel />
      <PendingHoldsPanel />
      <ServerLogs logs={logs} connected={connected} onClear={clearLogs} />
      <SettingsPanel />
    </div>
  );
}
