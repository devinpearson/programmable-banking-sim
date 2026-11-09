import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const HOME_CURRENCY = 'ZAR'

export interface Conversion {
  currencyCode: string
  // In the card's transaction currency, e.g. 12.5 USD.
  amount: number
  zarPerUnit: number
  // What the account is charged, rounded to the cent.
  zarAmount: number
}

// Convert a card amount in minor units (cents) of any currency to rand, the
// way the bank charges a foreign purchase. Rand amounts pass straight
// through. Returns null when there is no rate for the currency.
export async function toRand(currencyCode: string, centsAmount: number): Promise<Conversion | null> {
  const code = currencyCode.toUpperCase()
  if (code === HOME_CURRENCY) {
    const amount = centsAmount / 100
    return { currencyCode: code, amount, zarPerUnit: 1, zarAmount: amount }
  }
  const rate = await prisma.exchangeRate.findUnique({ where: { currencyCode: code } })
  if (!rate) {
    return null
  }
  const zarPerUnit = rate.zarPerUnit.toNumber()
  return {
    currencyCode: code,
    amount: centsAmount / 100,
    zarPerUnit,
    zarAmount: Math.round(centsAmount * zarPerUnit) / 100,
  }
}
