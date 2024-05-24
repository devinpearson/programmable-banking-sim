import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const currencyData: Prisma.CurrencyCreateInput[] = [
    { code: 'ZAR', name: 'South African Rand' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'USD', name: 'United States Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'CHF', name: 'Swiss Franc' },
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'DKK', name: 'Danish Krone' },
    { code: 'HKD', name: 'Hong Kong Dollar' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'MUR', name: 'Mauritius Rupee' },
    { code: 'NZD', name: 'New Zealand Dollar' },
    { code: 'NOK', name: 'Norwegian Krone' },
    { code: 'SGD', name: 'Singapore Dollar' },
    { code: 'SEK', name: 'Swedish Krona' },
    { code: 'AED', name: 'Emirati Dirham' },
    { code: 'BWP', name: 'Botswana Pula' },
    { code: 'INR', name: 'Indian Rupee' },
    { code: 'KES', name: 'Kenyan Shilling' },
    { code: 'NGN', name: 'Nigerian Naira' },
    { code: 'RUB', name: 'Russian Ruble' },
    { code: 'TRY', name: 'Turkish Lira' }
]

export async function seedCurrencies() {
    for (const c of currencyData) {
        const currency = await prisma.currency.create({
        data: c,
        })
        console.log(`Created currency with code: ${currency.code}`)
    }
}