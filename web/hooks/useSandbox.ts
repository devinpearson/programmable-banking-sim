'use client';

import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { io } from 'socket.io-client';
import { getApiBaseUrl } from '@/lib/api/common';
import {
  getAccountsOverview,
  getBeneficiaries,
  getBeneficiaryCategories,
  getCards,
  getTransactions,
  type TransactionFilters,
  getExchangeRates,
  getScenarios,
  getSettings,
  getSummary,
} from '@/lib/api/sandbox';
import { appendLog } from '@/lib/banking';

// The sandbox is local and changes underneath the page (Postman calls, other
// tabs), so data is refreshed on focus; live updates come over the socket.
const SWR_CONFIG = {
  revalidateOnFocus: true,
  dedupingInterval: 500,
  errorRetryCount: 2,
};

export const KEYS = {
  accounts: 'accounts-overview',
  cards: 'cards',
  summary: 'summary',
  scenarios: 'scenarios',
  settings: 'settings',
  exchangeRates: 'exchange-rates',
  beneficiaries: 'beneficiaries',
  beneficiaryCategories: 'beneficiary-categories',
  // Per account and filters: ['transactions', accountId, filters].
  transactions: 'transactions',
} as const;

export function useAccountsOverview() {
  return useSWR(KEYS.accounts, getAccountsOverview, SWR_CONFIG);
}

export function useCards() {
  return useSWR(KEYS.cards, getCards, SWR_CONFIG);
}

export function useSummary() {
  return useSWR(KEYS.summary, getSummary, SWR_CONFIG);
}

export function useScenarios() {
  return useSWR(KEYS.scenarios, getScenarios, { ...SWR_CONFIG, revalidateOnFocus: false });
}

export function useExchangeRates() {
  return useSWR(KEYS.exchangeRates, getExchangeRates, { ...SWR_CONFIG, revalidateOnFocus: false });
}

export function useTransactions(accountId: string | null, filters: TransactionFilters) {
  return useSWR(
    accountId ? [KEYS.transactions, accountId, filters] : null,
    () => getTransactions(accountId as string, filters),
    { ...SWR_CONFIG, keepPreviousData: true },
  );
}

export function useBeneficiaries() {
  return useSWR(KEYS.beneficiaries, getBeneficiaries, SWR_CONFIG);
}

export function useBeneficiaryCategories() {
  return useSWR(KEYS.beneficiaryCategories, getBeneficiaryCategories, { ...SWR_CONFIG, revalidateOnFocus: false });
}

export function useSettings() {
  return useSWR(KEYS.settings, getSettings, { ...SWR_CONFIG, revalidateOnFocus: false });
}

// Refresh everything that a write can change.
export function useRefreshSandbox() {
  const { mutate } = useSWRConfig();
  return () =>
    Promise.all([
      mutate(KEYS.accounts),
      mutate(KEYS.cards),
      mutate(KEYS.summary),
      mutate(KEYS.beneficiaries),
      // Every open transaction list, whatever its account and filters.
      mutate(key => Array.isArray(key) && key[0] === KEYS.transactions),
    ]);
}

// Live server logs, and a refresh whenever the API reports a data change
// (its 'database-summary' event fires after every write).
export function useLiveUpdates() {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const refresh = useRefreshSandbox();

  useEffect(() => {
    const socket = io(getApiBaseUrl());
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('logs', (line: string) => setLogs(lines => appendLog(lines, line)));
    socket.on('database-summary', () => {
      void refresh();
    });
    return () => {
      socket.disconnect();
    };
    // refresh is stable enough: it only closes over SWR's global mutate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { logs, connected, clearLogs: () => setLogs([]) };
}
