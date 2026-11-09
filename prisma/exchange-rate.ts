import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Rand per unit for the seeded currencies (prisma/currency.ts). Illustrative
// sandbox values, not live rates.
const exchangeRates: Record<string, number> = {
  ZAR: 1,
  USD: 17.6,
  EUR: 20.4,
  GBP: 23.3,
  AUD: 11.5,
  CHF: 21.9,
  CAD: 12.6,
  DKK: 2.73,
  HKD: 2.26,
  JPY: 0.117,
  MUR: 0.38,
  NZD: 10.3,
  NOK: 1.72,
  SGD: 13.6,
  SEK: 1.86,
  AED: 4.79,
  BWP: 1.31,
  INR: 0.2,
  KES: 0.136,
  NGN: 0.0118,
  RUB: 0.22,
  TRY: 0.42,
}

export async function seedExchangeRates() {
  for (const [currencyCode, zarPerUnit] of Object.entries(exchangeRates)) {
    await prisma.exchangeRate.upsert({
      where: { currencyCode },
      update: { zarPerUnit },
      create: { currencyCode, zarPerUnit },
    })
  }
  console.log(`Seeded ${Object.keys(exchangeRates).length} exchange rates`)
}
