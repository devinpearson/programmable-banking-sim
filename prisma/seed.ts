import { PrismaClient } from '@prisma/client'
import { seedCurrencies } from './currency'
import { seedCountries } from './country'
import { seedMerchants } from './merchant'
import { seedAccounts } from './account'
import { seedTransactions } from './transaction'
import { seedSettings } from './settings'

const prisma = new PrismaClient()

async function main() {
  console.log(`Start seeding ...`)
  
  await seedCurrencies()
  await seedCountries()
  await seedMerchants()
  await seedAccounts()
  await seedTransactions()
  await seedSettings()

  console.log(`Seeding finished.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })