import { PrismaClient } from '@prisma/client'
import { seedCurrencies } from './currency.js'
import { seedCountries } from './country.js'
import { seedMerchants } from './merchant.js'
import { seedAccounts } from './account.js'
import { seedTransactions } from './transaction.js'
import { seedSettings } from './settings.js'
import { seedCardCodes } from './card-code.js'
import { seedCards } from './card.js'

const prisma = new PrismaClient()

async function main() {
  console.log(`Start seeding ...`)

  await seedCurrencies()
  await seedCountries()
  await seedMerchants()
  await seedAccounts()
  await seedTransactions()
  await seedCards()
  await seedCardCodes()
  await seedSettings()

  console.log(`Seeding finished.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
