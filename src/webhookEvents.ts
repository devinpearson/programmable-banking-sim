// Events the sandbox publishes to registered webhooks (sandbox-only; the
// Investec API has no webhooks, card code's afterTransaction is the closest).
export const WEBHOOK_EVENTS = [
  // A transaction posted: top-ups, transfer and payment legs, posted
  // swipes, created transactions, and pending holds that settle.
  'transaction.posted',
  // A card hold was placed (or a pending transaction created).
  'transaction.pending',
  // A pending hold was reversed, releasing the funds.
  'transaction.reversed',
  // A live card swipe was approved or declined.
  'card.authorization',
] as const
