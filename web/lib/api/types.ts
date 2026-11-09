// Shapes of the sandbox API responses, from its OpenAPI document.
// schema.d.ts is generated: run `npm run api:types` after the API changes
// (and `npm run openapi:generate` in the API first).
import type { components } from './schema';

type Schemas = components['schemas'];

export type Account = Schemas['Account'];
export type Balance = Schemas['Balance'];
export type PendingTransaction = Schemas['PendingTransaction'];
export type Card = Schemas['Card'];
export type SwipeResult = Schemas['SwipeResult'];
export type Scenario = Schemas['Scenario'];
export type DatabaseSummary = Schemas['DatabaseSummary'];
export type Settings = Schemas['Settings'];
export type ConsentDetails = Schemas['ConsentDetails'];
export type CardStatus = 'Active' | 'Stopped';

// An account with its balances, as the dashboard shows it.
export interface AccountWithBalance extends Account {
  currentBalance: number;
  availableBalance: number;
}
