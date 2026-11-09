// Shapes of the sandbox API responses the web app uses.

export interface Account {
  accountId: string;
  accountNumber: string;
  accountName: string;
  referenceName: string;
  productName: string;
  kycCompliant: boolean;
  profileId: string;
  profileName: string;
}

export interface Balance {
  accountId: string;
  currentBalance: number;
  availableBalance: number;
  currency: string;
}

export interface PendingTransaction {
  transactionId: number;
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  transactionType: string;
  status: 'PENDING';
  description: string;
  cardNumber: string;
  transactionDate: string;
  amount: string;
}

// An account with its balances, as the dashboard shows it.
export interface AccountWithBalance extends Account {
  currentBalance: number;
  availableBalance: number;
}

export interface Card {
  CardKey: string;
  CardNumber: string;
  IsProgrammable: boolean;
  status: string;
  CardTypeCode: string;
  AccountNumber: string;
  AccountId: string;
}

export type CardStatus = 'Active' | 'Stopped';

export interface SwipeResult {
  result: boolean;
  reason?: 'insufficient_funds' | 'card_not_active';
  transaction: { transactionId: number; status: 'PENDING' | 'POSTED' } | null;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
}

export interface DatabaseSummary {
  profiles: number;
  accounts: number;
  cards: number;
  transactions: number;
}

export interface Settings {
  client_id: string;
  client_secret: string;
  api_key: string;
  token_expiry: number | string;
  auth: boolean | string;
}

export interface ConsentDetails {
  scopes: { scope: string; description: string }[];
  accounts: { accountId: string; accountNumber: string; accountName: string; productName: string }[];
}
