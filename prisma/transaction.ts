import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const accountId = '4675778129910189600000003'

const transactionData: Prisma.TransactionCreateInput[] = [
    { accountId, type: 'DEBIT', transactionType: 'CardPurchases', status: 'POSTED', description: 'HTTP://WWW.UBEREATS.CO PARKTOWN NOR ZA', cardNumber: '402167xxxxxx9999', postedOrder: 0, postingDate: '2023-01-22', valueDate: '2022-05-15', actionDate: '2022-04-24', transactionDate: '2022-04-21', amount: '40.99', runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'CardPurchases', status: 'POSTED', description: 'HTTP://WWW.UBEREATS.CO PARKTOWN NOR ZA', cardNumber: '402167xxxxxx9999', postedOrder: 0, postingDate: '2023-01-22', valueDate: '2022-05-15', actionDate: '2022-04-24', transactionDate: '2022-04-21', amount: 406.9, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'FeesAndInterest', status: 'POSTED', description: 'MONTHLY SERVICE CHARGE', cardNumber: '', postedOrder: 0, postingDate: '2023-01-16', valueDate: '2023-01-15', actionDate: '2022-04-24', transactionDate: '2022-04-15', amount: 555, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'FeesAndInterest', status: 'POSTED', description: 'DEBIT INTEREST', cardNumber: '', postedOrder: 0, postingDate: '2023-01-16', valueDate: '2023-01-15', actionDate: '2022-04-24', transactionDate: '2022-04-15', amount: 0.61, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'FasterPay', status: 'POSTED', description: 'FASTER PAYMENT FEE', cardNumber: '', postedOrder: 0, postingDate: '2023-01-07', valueDate: '2023-01-15', actionDate: '2022-04-24', transactionDate: '2022-04-07', amount: 40, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'FasterPay', status: 'POSTED', description: 'BIZ', cardNumber: '', postedOrder: 0, postingDate: '2023-01-07', valueDate: '2022-04-07', actionDate: '2022-04-24', transactionDate: '2022-04-07', amount: 5000, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'OnlineBankingPayments', status: 'POSTED', description: 'Apple Sauce', cardNumber: '', postedOrder: 0, postingDate: '2023-01-04', valueDate: '2022-04-04', actionDate: '2022-04-24', transactionDate: '2022-04-04', amount: 10000, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'DebitOrders', status: 'POSTED', description: 'INVESTECPB 40756003 09375003', cardNumber: '', postedOrder: 0, postingDate: '2023-01-01', valueDate: '2022-04-01', actionDate: '2022-04-24', transactionDate: '2022-04-01', amount: '7338.37', runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'DebitOrders', status: 'POSTED', description: 'VIRGIN ACT400396003 178003', cardNumber: '', postedOrder: 0, postingDate: '2023-01-01', valueDate: '2022-04-01', actionDate: '2022-04-24', transactionDate: '2022-04-01', amount: '232.5', runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'FasterPay', status: 'POSTED', description: 'FASTER PAYMENT FEE', cardNumber: '', postedOrder: 0, postingDate: '2022-12-30', valueDate: '2022-04-15', actionDate: '2022-04-24', transactionDate: '2022-03-30', amount: 40, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'FasterPay', status: 'POSTED', description: 'BIZ', cardNumber: '', postedOrder: 0, postingDate: '2022-12-30', valueDate: '2022-12-30', actionDate: '2022-04-24', transactionDate: '2022-03-30', amount: '25000', runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'OnlineBankingPayments', status: 'POSTED', description: 'LEVIES', cardNumber: '', postedOrder: 0, postingDate: '2022-12-30', valueDate: '2022-03-30', actionDate: '2022-04-24', transactionDate: '2022-03-30', amount: '4593.63', runningBalance: 0 },
    { accountId, type: 'CREDIT', transactionType: 'Deposits', status: 'POSTED', description: 'SALARY', cardNumber: '', postedOrder: 0, postingDate: '2022-12-25', valueDate: '2022-03-25', actionDate: '2022-04-24', transactionDate: '2022-03-25', amount: '17551.96', runningBalance: 0 }
  ]

export async function seedTransactions() {
    for (const c of transactionData) {
        const transaction = await prisma.transaction.create({
        data: c,
        })
        console.log(`Created transaction with id: ${transaction.accountId}`)
    }
}