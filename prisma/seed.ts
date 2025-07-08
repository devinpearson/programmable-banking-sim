import { PrismaClient } from '@prisma/client'
import { seedCurrencies } from './currency'
import { seedCountries } from './country'
import { seedMerchants } from './merchant'
import { seedProfiles } from './profile'
import { seedAccounts } from './account'
import { seedTransactions } from './transaction'
import { seedSettings } from './settings'
import { seedCardCodes } from './card-code'
import { seedCards } from './card'

const prisma = new PrismaClient()

async function main() {
  console.log(`Start seeding ...`)

  await seedCurrencies()
  await seedCountries()
  await seedMerchants()
  await seedProfiles()
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
