'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useLiveUpdates } from '@/hooks/useSandbox';
import AccountsPanel from './AccountsPanel';
import BeneficiariesPanel from './BeneficiariesPanel';
import CardsPanel from './CardsPanel';
import ControlBar from './ControlBar';
import ExchangeRatesPanel from './ExchangeRatesPanel';
import FaultsPanel, { FaultBanner } from './FaultsPanel';
import PendingHoldsPanel from './PendingHoldsPanel';
import ServerLogs from './ServerLogs';
import SettingsPanel from './SettingsPanel';
import SummaryCards from './SummaryCards';
import TimePanel, { ClockBanner } from './TimePanel';
import TransactionsPanel from './TransactionsPanel';
import WebhooksPanel from './WebhooksPanel';

// The dashboard's sections. The everyday banking is first; the tools for
// simulating the bank and setting up the sandbox are a tab away.
const TABS = [
  { id: 'banking', label: 'Banking' },
  { id: 'simulate', label: 'Simulate' },
  { id: 'sandbox', label: 'Sandbox' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function tabFromHash(): TabId {
  const hash = window.location.hash.slice(1);
  return TABS.find(t => t.id === hash)?.id ?? 'banking';
}

function Tabs({ current, onChange }: { current: TabId; onChange: (tab: TabId) => void }) {
  return (
    <div role="tablist" aria-label="Dashboard sections" className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
      {TABS.map(tab => {
        const selected = tab.id === current;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              selected
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function TabPanel({ id, current, children }: { id: TabId; current: TabId; children: ReactNode }) {
  if (id !== current) return null;
  return (
    <div id={`tabpanel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} className="flex flex-col gap-6">
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { logs, connected, clearLogs } = useLiveUpdates();
  const [tab, setTab] = useState<TabId>('banking');

  // The tab is in the URL (#simulate), so links and reloads keep it.
  useEffect(() => {
    const sync = () => setTab(tabFromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  function choose(next: TabId) {
    setTab(next);
    history.replaceState(null, '', next === 'banking' ? window.location.pathname : `#${next}`);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <FaultBanner />
      <ClockBanner />
      <ControlBar />
      <SummaryCards />
      <Tabs current={tab} onChange={choose} />
      <TabPanel id="banking" current={tab}>
        <AccountsPanel />
        <TransactionsPanel />
        <PendingHoldsPanel />
        <CardsPanel />
        <BeneficiariesPanel />
      </TabPanel>
      <TabPanel id="simulate" current={tab}>
        <TimePanel />
        <WebhooksPanel />
        <FaultsPanel />
        <ExchangeRatesPanel />
      </TabPanel>
      <TabPanel id="sandbox" current={tab}>
        <SettingsPanel />
        <ServerLogs logs={logs} connected={connected} onClear={clearLogs} />
      </TabPanel>
    </div>
  );
}
