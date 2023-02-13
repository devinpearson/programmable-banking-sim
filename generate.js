const { faker } = require('@faker-js/faker')
const dayjs = require('dayjs')

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

module.exports = { randomType, randomCompany, randomArea, randomDescription, randomTransaction, randomTransactionType }
