import { faker } from '@faker-js/faker'
import * as dayjs from 'dayjs'

const companies = [
  'ENGEN',
  'SASOL',
  'TOTAL',
  'SHELL',
  'BP',
  'ISTORE',
  'POSTNET',
  'ESKORT',
  'NANDOS',
  'BOOST JUICE',
  'BODY FUEL EXPRESS',
  'GAS XPRESS',
  'BWH',
  'MCD',
  'PNP',
  'PNP EXP',
  'BILTON AT ZA',
  'CLICKS',
  'LEROY MERLIN',
  'WEST PACK',
  'TASKO SWEETS',
  'PETZONE',
  'MINTRAMS',
  'DISCHEM',
  'PIZZA PERFECT',
  'CHECKERS',
  'ANDICCIO 24',
  'DECATHLON',
  'PETZONE',
  'WIMPY',
  'SPAR',
  'SUPERSPAR',
  'MRPRICEH',
  'TURN N TENDER',
  'PIZA E VINO',
  'WOOLWORTHS',
  'UBER EATS',
  'UBER SA HELP.UBER.COM',
  'DOPPIO ZERO',
  'KFC',
  'TOYS R US',
  'JJ Cale',
  'GAME'
]

const areas = [
  'WESTDENE',
  'ALLENS NEK',
  'FLORIDA',
  'BOSKRUIN',
  'SUNDOWNER',
  'CLEARWATER',
  'BRYANSTON',
  'ROODEPOORT',
  'LITTLE FALLS',
  'WILGERHEUWEL',
  'WATERKLOOF',
  'WATERKLOOF RIDGE',
  'RADIOKOP',
  'EAGLES LANDING',
  'STRUBENSVALLEY',
  'RED VALLEY',
  'BRACKENFELL',
  'KUILSRIVER',
  'SUNNINGHILL',
  'RUIMSIG',
  'SUNNINGDALE',
  'NEWLANDS',
  'BLACKHEATH',
  'SANDTON',
  'RANDBURG'
]

function randomCompany () {
  const company = faker.helpers.arrayElement(companies)
  return company
}

function randomArea () {
  const area = faker.helpers.arrayElement(areas)
  return area
}

function randomDescription () {
  const description = randomCompany() + ' ' + randomArea() + ' ZA'
  return description
}

function randomType () {
  const type = faker.helpers.arrayElement(['DEBIT', 'CREDIT'])
  return type
}

function randomTransactionType () {
  const transactionType = faker.helpers.arrayElement(['CardPurchases', 'OnlineBankingPayments', 'FasterPay', 'DebitOrders', 'FeesAndInterest'])
  return transactionType
}

function randomBank () {
  const bank = faker.helpers.arrayElement([{ name: 'FIRST NATIONAL BANK', code: '250655' }, { name: 'ABSA', code: '632005' }, { name: 'NEDBANK', code: '198765' }, { name: 'CAPITEC', code: '470010' }, { name: 'STANDARD BANK', code: '051001' }])
  return bank
}

function randomTransaction (accountId) {
  const transaction = {
    accountId,
    type: randomType(),
    transactionType: randomTransactionType(),
    status: 'POSTED',
    description: randomDescription(),
    cardNumber: '402167xxxxxx9999',
    postingDate: dayjs().format('YYYY-MM-DD'),
    valueDate: dayjs().format('YYYY-MM-DD'),
    actionDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    transactionDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    amount: faker.finance.amount(5, 1000)
  }
  return transaction
}

function randomAccount () {
  const randomNumber = faker.datatype.number(99)
  const account = {
    accountId: '46757781299101896000000' + randomNumber,
    accountNumber: '100124200' + randomNumber,
    accountName: faker.name.fullName(),
    referenceName: faker.name.fullName(),
    productName: 'Private Bank Account'
  }
  return account
}

function randomBeneficiary () {
  const bank = randomBank()
  const beneficiary = {
    beneficiaryId: 'MTAxOTA2OTI5Nz' + faker.datatype.number(99) + 'MjM=',
    accountNumber: '10012420003', // + faker.datatype.number(99),
    code: bank.code,
    bank: bank.name,
    beneficiaryName: faker.name.fullName(),
    lastPaymentAmount: faker.finance.amount(5, 1000),
    lastPaymentDate: dayjs().format('YYYY-MM-DD'),
    cellNo: null,
    emailAddress: null,
    name: faker.name.fullName(),
    referenceAccountNumber: '100124200' + faker.datatype.number(99),
    referenceName: faker.name.fullName(),
    categoryId: '10189603223001',
    profileId: '10189603223'
  }
  return beneficiary
}

module.exports = { randomType, randomCompany, randomArea, randomDescription, randomTransaction, randomTransactionType, randomAccount, randomBeneficiary }
