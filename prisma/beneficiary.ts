import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const beneficiaryData: Prisma.BeneficiaryCreateInput[] = [
  {
    beneficiaryId: 'MTAxOTA2OTI5Nzc0Mjz=',
    accountNumber: '10012420003',
    code: '679000',
    bank: 'DISCOVERY BANK',
    beneficiaryName: 'Discovery CC',
    lastPaymentAmount: '2,000.00',
    lastPaymentDate: '25/04/2023',
    cellNo: null,
    emailAddress: null,
    name: 'Discovery CC',
    referenceAccountNumber: 'CC',
    referenceName: 'CC',
    categoryId: '10189603223001',
    profileId: '10189603223001',
  },
  {
    beneficiaryId: 'MTAxOTA2OTI5Nzc0Mjk=',
    accountNumber: '10012420003',
    code: '470010',
    bank: 'CAPITEC BANK LIMITED',
    beneficiaryName: 'S Jones',
    lastPaymentAmount: '1,400.00',
    lastPaymentDate: '12/05/2023',
    cellNo: null,
    emailAddress: null,
    name: 'S Jones',
    referenceAccountNumber: 'money',
    referenceName: 'money',
    categoryId: '10189603223001',
    profileId: '10189603223001',
  },
  {
    beneficiaryId: 'MTAxOTA2OTI5Nzc0MzU=',
    accountNumber: '10012420003',
    code: '580105',
    bank: 'INVESTEC BANK LIMITED',
    beneficiaryName: 'easy equities',
    lastPaymentAmount: '2,500.00',
    lastPaymentDate: '15/05/2023',
    cellNo: null,
    emailAddress: null,
    name: 'easy equities',
    referenceAccountNumber: 'EE-8848555',
    referenceName: 'EE-8848555',
    categoryId: '10189603223001',
    profileId: '10189603223001',
  },
]

export async function seedBeneficiaries() {
  for (const c of beneficiaryData) {
    const beneficiary = await prisma.beneficiary.create({
      data: c,
    })
    console.log(`Created account with id: ${beneficiary.beneficiaryId}`)
  }
}
