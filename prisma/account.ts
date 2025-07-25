import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const accountData: Prisma.AccountCreateInput[] = [
  {
    accountId: '4675778129910189600000003',
    accountNumber: '10012420003',
    accountName: 'Mr J Soap',
    referenceName: 'Mr J Soap',
    productName: 'Private Bank Account',
    kycCompliant: true,
    profileId: '10001234567890',
    profileName: 'Joe Soap',
  },
  {
    accountId: '4675778129910189600000004',
    accountNumber: '10012420004',
    accountName: 'Mr J Soap',
    referenceName: 'Mr J Soap',
    productName: 'PrimeSaver',
    kycCompliant: true,
    profileId: '10001234567890',
    profileName: 'Joe Soap',
  },
  {
    accountId: '4675778129910189600000005',
    accountNumber: '10012420005',
    accountName: 'Mr J Soap',
    referenceName: 'Mr J Soap',
    productName: 'Cash Management Account',
    kycCompliant: true,
    profileId: '10001234567890',
    profileName: 'Joe Soap',
  },
  {
    accountId: '4675778129910189600000006',
    accountNumber: '10012420006',
    accountName: 'Mr J Soap',
    referenceName: 'Mr J Soap',
    productName: 'Mortgage Loan Account',
    kycCompliant: true,
    profileId: '10001234567890',
    profileName: 'Joe Soap',
  },
  {
    accountId: '4675778129910189600000007',
    accountNumber: '10012420007',
    accountName: 'Mr J Soap',
    referenceName: 'Mr J Soap',
    productName: 'Instalment Sale Loan Account',
    kycCompliant: true,
    profileId: '10001234567890',
    profileName: 'Joe Soap',
  },
]

export async function seedAccounts() {
  for (const c of accountData) {
    const account = await prisma.account.create({
      data: c,
    })
    console.log(`Created account with id: ${account.accountId}`)
  }
}
