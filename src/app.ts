import express, { Request, Response } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dayjs from 'dayjs';
import dotenv from 'dotenv'
import { Prisma, PrismaClient } from '@prisma/client'
import { Server } from "socket.io"
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createServer } from 'node:http';

dotenv.config()

export const port = process.env.PORT || 3000
const dbFile = process.env.DB_FILE || 'investec.db'
// const overdraft = process.env.OVERDRAFT || 5000
const prisma = new PrismaClient()
export const app = express()
export const server = createServer(app);
const io = new Server(server);
let settings = {} as Settings
await fetchSettings()

import { randomBeneficiary, randomTransaction, randomAccount } from './generate.js'

app.use(cors())
// Configuring body parser middleware
app.use(express.urlencoded({ extended: false }))
app.use(morgan('combined'));
app.use(express.json())
app.use(express.static('public'));

interface AccessToken {
    expires_at: string
    scope: string
}

interface Settings {
    client_id: string
    client_secret: string
    api_key: string
    token_expiry: number
    auth: boolean
}

interface ControlMessage {
    action: string
    message: string

}

let accessTokens = {} as Record<string, AccessToken>

const __dirname = dirname(fileURLToPath(import.meta.url));

const messageQueue = 'logs'

io.on('connection', (socket) => {
    // socket.broadcast.emit('hi');
    socket.on('envs', (msg) => {
        console.log('message: ' + msg);
        settings = msg
        io.emit('envs', settings);
    });
    socket.on('control', async (msg: ControlMessage) => {
        console.log('control: ' + msg);
        const { action, message } = msg
        console.log('action: ' + action);
        switch (action) {
            case 'clear':
                await prisma.account.deleteMany()
                await prisma.transaction.deleteMany()
                await prisma.beneficiary.deleteMany()
                break
            case 'restore':
                await prisma.account.deleteMany()
                await prisma.transaction.deleteMany()
                await prisma.beneficiary.deleteMany()
                seedAccounts()
                seedTransactions()
                seedBeneficiaries()
                break
        }
        //io.emit('control', settings);
    });
    socket.on(messageQueue, (msg) => {
        console.log('message: ' + msg);
        io.emit(messageQueue, msg);
    });
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
  });

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.get('/guide', (req, res) => {
    res.sendFile(join(__dirname, 'guide.html'));
  });

app.post('/envs', async (req: Request, res: Response) => {
    await prisma.setting.update({
        where: {name:'client_id'},
        data: {value: req.body.client_id}
    })
    await prisma.setting.update({
        where: {name:'client_secret'},
        data: {value: req.body.client_secret}
    })
    await prisma.setting.update({
        where: {name:'api_key'},
        data: {value: req.body.api_key}
    })
    await prisma.setting.update({
        where: {name:'token_expiry'},
        data: {value: req.body.token_expiry as unknown as string}
    })
    let auth = 'false'
    if (req.body.auth === true) {
        auth = 'true'
    }
    await prisma.setting.update({
        where: {name:'auth'},
        data: {value: auth}
    })
    settings = req.body
    return res.json(settings)
});

app.post('/identity/v2/oauth2/token', (req: Request, res: Response) => {
    try {
        const authStr = Buffer.from((req.headers.authorization ?? '').split(' ')[1], 'base64').toString()
        const [clientId, clientSecret] = authStr.split(':')

        if (settings.client_id !== '' && settings.client_secret !== '') {
            if (clientId !== settings.client_id || clientSecret !== settings.client_secret) {
                return formatErrorResponse(req, res, 401)
            }
        }
        if (settings.api_key !== '' && req.headers['x-api-key'] !== settings.api_key) {
            return formatErrorResponse(req, res, 401)
        }
        // Generate a token string
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        const expiryDate = dayjs().add(settings.token_expiry, 'seconds').format()
        accessTokens[token] = { expires_at: expiryDate, scope: 'accounts' }
        return res.json({ access_token: token, token_type: 'Bearer', expires_in: settings.token_expiry, scope: 'accounts' })
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

function isValidToken (req: Request) {
    if (settings.auth !== true) {
        return true
    }
    if (!req.get('authorization')) {
        return false
    }
    const authorization = req.get('authorization')?.split(' ')[1]
    if (!authorization) {
        return false
    }
    if (accessTokens[authorization] && dayjs().isBefore(accessTokens[authorization].expires_at)) {
        return true
    }

    return false
}

app.get('/za/pb/v1/accounts', async (req: Request, res: Response) => {
    try {
        if (!isValidToken(req)) {
            return formatErrorResponse(req, res, 401)
        }

        const accounts = await prisma.account.findMany()
        const data = { accounts }
        return formatResponse(data, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

app.get('/za/pb/v1/accounts/:accountId/balance', async (req: Request, res: Response) => {
    try {
        if (!isValidToken(req)) {
            return formatErrorResponse(req, res, 401)
        }
        const accountId = req.params.accountId

        const account = await prisma.account.findFirst({
            where: {
            accountId: accountId
            }
        })
        if (!account) {
            return formatErrorResponse(req, res, 404) // no account was found
        }

        const transactionsArr = await prisma.transaction.findMany({
            where: {
            accountId: accountId
            }
        })
            let runningBalance = 0

            for (let j = 0; j < transactionsArr.length; j++) {
                let amount = transactionsArr[j].amount.toNumber()
                if (transactionsArr[j].type === 'CREDIT') {
                    runningBalance += amount
                } else {
                    runningBalance -= amount
                }
            }

            const balance =  runningBalance.toFixed(2)
        // overdraft - balance // workout over
        // fetch the currentBalance and availableBalance from the transactions table
        const data = {
            accountId,
            currentBalance: +balance,
            availableBalance: 0,
            currency: 'ZAR'
        }
        return formatResponse(data, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

app.get('/za/pb/v1/accounts/:accountId/transactions', async (req: Request, res: Response) => {
    try {
        if (!isValidToken(req)) {
            return formatErrorResponse(req, res, 401)
        }
        const accountId = req.params.accountId
        // check that the account exists
        const account = await prisma.account.findFirst({
            where: {
            accountId: accountId
            }
        })
        if (!account) {
            console.log('no account found')
            return formatErrorResponse(req, res, 404) // no account was found
        }
        const transactionsArr = await prisma.transaction.findMany({
            where: {
            accountId: accountId
            }
        })
        //    console.log(transactionsArr)
        const toDate = req.query.toDate ?? dayjs().format('YYYY-MM-DD') // set to today
        const fromDate = req.query.fromDate ?? dayjs().subtract(180, 'day').format('YYYY-MM-DD') // set to 180 in the passed
        const transactionType = req.query.transactionType ?? null

        let postedOrder = 0
        let runningBalance: number = 0
        let transactions = []
        for (let j = 0; j < transactionsArr.length; j++) {
            postedOrder++
            let amount = transactionsArr[j].amount.toNumber()
            if (transactionsArr[j].type === 'CREDIT') {
            runningBalance += amount
            } else {
            runningBalance -= amount
            }
            if (transactionType !== null && transactionsArr[j].transactionType !== transactionType) {
            continue
            }
            const transactionDate = dayjs(transactionsArr[j].postingDate)
            // compare both dates together
            if (transactionDate.isBefore(fromDate as string, 'day')) {
            continue
            }
            if (transactionDate.isAfter(toDate as string, 'day')) {
            continue
            }
            transactionsArr[j].postedOrder = new Prisma.Decimal(postedOrder)
            transactionsArr[j].runningBalance = new Prisma.Decimal(+runningBalance.toFixed(2))
            transactions.push({
                "accountId": transactionsArr[j].accountId,
                "type": transactionsArr[j].type,
                "transactionType": transactionsArr[j].transactionType,
                "status": transactionsArr[j].status,
                "description": transactionsArr[j].description,
                "cardNumber": transactionsArr[j].cardNumber,
                "postedOrder": transactionsArr[j].postedOrder,
                "postingDate": transactionsArr[j].postingDate,
                "valueDate": transactionsArr[j].valueDate,
                "actionDate": transactionsArr[j].actionDate,
                "transactionDate": transactionsArr[j].transactionDate,
                "amount": transactionsArr[j].amount,
                "runningBalance": transactionsArr[j].runningBalance
            })
        }
        const data = { transactions }
        return formatResponse(data, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

// transfer multiple transactions
app.post('/za/pb/v1/accounts/:accountId/transfermultiple', async (req: Request, res: Response) => {
    try {
        const accountId = req.params.accountId
        // check that the account exists
        const account = await prisma.account.findFirst({
        where: {
            accountId: accountId
        }
        })
        if (!account) {
        console.log('no account found')
        return formatErrorResponse(req, res, 404) // no account was found
        }
        let transfers = req.body.transferList
        console.log(transfers)
        for (let i = 0; i < transfers.length; i++) {
            const beneficiary = await prisma.account.findFirst({
                where: {
                accountId: transfers[i].beneficiaryAccountId
                }
            })
            if (!beneficiary) {
                console.log('no beneficiary account found')
                return formatErrorResponse(req, res, 404) // no account was found
            }
            let transactionOut =
                {
                    accountId: accountId,
                    type: 'DEBIT',
                    transactionType: 'Transfer',
                    status: 'POSTED',
                    description: transfers[i].myReference,
                    cardNumber: '',
                    postedOrder: 0,
                    postingDate: dayjs().format('YYYY-MM-DD'),
                    valueDate: dayjs().format('YYYY-MM-DD'),
                    actionDate: dayjs().format('YYYY-MM-DD'),
                    transactionDate: dayjs().format('YYYY-MM-DD'),
                    amount: transfers[i].amount,
                    runningBalance: 0
                }
            // insert the transaction
            const transaction = await prisma.transaction.create({
            data: transactionOut
            })

            let transactionIn =
                {
                    accountId: transfers[i].beneficiaryAccountId,
                    type: 'CREDIT',
                    transactionType: 'Transfer',
                    status: 'POSTED',
                    description: transfers[i].theirReference,
                    cardNumber: '',
                    postedOrder: 0,
                    postingDate: dayjs().format('YYYY-MM-DD'),
                    valueDate: dayjs().format('YYYY-MM-DD'),
                    actionDate: dayjs().format('YYYY-MM-DD'),
                    transactionDate: dayjs().format('YYYY-MM-DD'),
                    amount: transfers[i].amount,
                    runningBalance: 0
                }
            // insert the transaction
            const transaction2 = await prisma.transaction.create({
            data: transactionIn
            })
        }

        return formatResponse(transfers, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

  // beneficiary payment
app.post('/za/pb/v1/accounts/:accountId/paymultiple', async (req: Request, res: Response) => {
    try {
        const accountId = req.params.accountId
        // check that the account exists
        const account = await prisma.account.findFirst({
        where: {
            accountId: accountId
        }
        })
        if (!account) {
        console.log('no account found')
        return formatErrorResponse(req, res, 404) // no account was found
        }
        let transfers = req.body.paymentList
        // console.log(transfers)
        for (let i = 0; i < transfers.length; i++) {
            const beneficiary = await prisma.beneficiary.findFirst({
                where: {
                beneficiaryId: transfers[i].beneficiaryId
                }
            })
            if (!beneficiary) {
                console.log('no beneficiary account found')
                return formatErrorResponse(req, res, 404) // no account was found
            }
            let transactionOut =
                {
                    accountId: accountId,
                    type: 'DEBIT',
                    transactionType: 'Transfer',
                    status: 'POSTED',
                    description: transfers[i].myReference,
                    cardNumber: '',
                    postedOrder: 0,
                    postingDate: dayjs().format('YYYY-MM-DD'),
                    valueDate: dayjs().format('YYYY-MM-DD'),
                    actionDate: dayjs().format('YYYY-MM-DD'),
                    transactionDate: dayjs().format('YYYY-MM-DD'),
                    amount: transfers[i].amount,
                    runningBalance: 0
                }
            // insert the transaction
            const transaction = await prisma.transaction.create({
            data: transactionOut
            })
        }

        return formatResponse(transfers, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})
// function to create transactions for an account
app.post('/za/pb/v1/accounts/:accountId/transactions', async (req: Request, res: Response) => {
    try {
        let randomTx = randomTransaction(req.params.accountId)
        randomTx = { ...randomTx, ...req.body }

        const accountId = req.params.accountId
        // check that the account exists
        const account = await prisma.account.findFirst({
            where: {
                accountId: accountId
            }
        })
        if (!account) {
            console.log('no account found')
            return formatErrorResponse(req, res, 404) // no account was found
        }
        // insert the transaction
        const transaction = await prisma.transaction.create({
            data: randomTx
        })
        return formatResponse(transaction, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

app.post('/za/pb/v1/accounts/:accountId/transactions', async (req: Request, res: Response) => {
    try {
        let randomTx = randomTransaction(req.params.accountId)
        randomTx.runningBalance = 0
        randomTx = { ...randomTx, ...req.body }

        const accountId = req.params.accountId
        // check that the account exists
        const account = await prisma.account.findFirst({
        where: {
            accountId: accountId
        }
        })
        if (!account) {
        console.log('no account found')
        return formatErrorResponse(req, res, 404) // no account was found
        }
        // insert the transaction
        const transaction = await prisma.transaction.create({
        data: randomTx
        })
        return formatResponse(transaction, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

app.delete('/za/pb/v1/accounts/:accountId/transactions/:postingDate', async (req: Request, res: Response) => {
    try {
        const accountId = req.params.accountId
        const postingDate = req.params.postingDate
        // check that the account exists
        const account = await prisma.account.findFirst({
            where: {
            accountId: accountId
            }
        })
        if (!account) {
            console.log('no account found')
            return formatErrorResponse(req, res, 404) // no account was found
        }
        // delete the transactions
        const transactionsArr = await prisma.transaction.deleteMany({
            where: {
            accountId: accountId,
            postingDate: postingDate
            }
        })

        return res.status(200).json()
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

// function to create an account
app.post('/za/pb/v1/accounts', async (req: Request, res: Response) => {
  try {
        let account = randomAccount()
        account = { ...account, ...req.body }
        // check that the account exists
        const accountcheck = await prisma.account.findFirst({
            where: {
            accountId: account.accountId
            }
        })
        if (accountcheck) {
            console.log('account found')
            return formatErrorResponse(req, res, 409) // account was found
        }
        // insert the transaction
        await prisma.account.create({
            data: account
        })

        return formatResponse(account, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

// function to delete an account
app.delete('/za/pb/v1/accounts/:accountId', async (req: Request, res: Response) => {
    try {
        const accountId = req.params.accountId
        // check that the account exists
        const account = await prisma.account.findFirst({
            where: {
            accountId: accountId
            }
        })
        if (!account) {
            console.log('no account found')
            return formatErrorResponse(req, res, 404) // no account was found
        }
        // remove the transactions
        await prisma.transaction.deleteMany({
            where: {
            accountId: accountId,
            }
        })
            await prisma.account.delete({
                where: {
                accountId: accountId
                }
            })

        return res.status(200).json()
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

app.get('/za/pb/v1/accounts/beneficiaries', async (req: Request, res: Response) => {
    try {
        if (!isValidToken(req)) {
            return formatErrorResponse(req, res, 401)
        }
        const result = await prisma.beneficiary.findMany()
        const data = { result }
        return formatResponse(data, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

// function to create an account
app.post('/za/pb/v1/accounts/beneficiaries', async (req: Request, res: Response) => {
    try {
        let beneficiary = randomBeneficiary()
        beneficiary = { ...beneficiary, ...req.body }
        
        // insert the beneficiary
        await prisma.beneficiary.create({
            data: beneficiary
        })

        return formatResponse(beneficiary, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

app.get('/za/v1/cards/countries', async (req: Request, res: Response) => {
    try {
        if (!isValidToken(req)) {
            return formatErrorResponse(req, res, 401)
        }
        const result = await prisma.country.findMany()
        const data = { result }
        return formatResponse(data, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

app.get('/za/v1/cards/currencies', async (req: Request, res: Response) => {
    try {
        if (!isValidToken(req)) {
            return formatErrorResponse(req, res, 401)
        }
        const result = await prisma.currency.findMany()
        const data = { result }
        return formatResponse(data, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

app.get('/za/v1/cards/merchants', async (req: Request, res: Response) => {
    try {
        if (!isValidToken(req)) {
            return formatErrorResponse(req, res, 401)
        }
        const result = await prisma.merchant.findMany()
        const data = { result }
        return formatResponse(data, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

app.delete('/clear', async (req: Request, res: Response) => {
    try {
        // delete the accounts
        await prisma.account.deleteMany()
        // delete the transactions
        await prisma.transaction.deleteMany()
        // delete the beneficiaries
        await prisma.beneficiary.deleteMany()

        return res.status(200).json()
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

import { seedAccounts } from '../prisma/account.js'
import { seedTransactions } from '../prisma/transaction.js'
import { seedBeneficiaries } from '../prisma/beneficiary.js'

app.get('/restore', async (req: Request, res: Response) => {
    try {
        await seedAccounts()
        await seedTransactions()
        await seedBeneficiaries()

        return res.status(200).json()
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

app.get('/envs', async (req: Request, res: Response) => {
    try {
        return formatResponse(settings, req, res)
    } catch (error) {
        console.log(error)
    return formatErrorResponse(req, res, 500)
    }
})

const formatResponse = (data: any, req: Request, res: Response) => {
    let date = new Date()
  io.sockets.emit(messageQueue, date.toUTCString() + ' ' + req.method + ' ' + req.url + ' HTTP/' + req.httpVersion + ' ' + res.statusCode);
  return res.json({
    data,
    links: {
      self: req.protocol + '://' + req.get('host') + req.originalUrl
    },
    meta: {
      totalPages: 1
    }
  })
}
function formatErrorResponse (req: Request, res: Response, code: number) {
    let date = new Date()
    io.sockets.emit(messageQueue, date.toUTCString() + ' ' + req.method + ' ' + req.url + ' HTTP/' + req.httpVersion + ' ' + code);
    return res.status(code).json()
}

async function fetchSettings() {
    const dbSettings = await prisma.setting.findMany()
    for (let i = 0; i < dbSettings.length; i++) {
        const setting = dbSettings[i]
        switch (setting.name) {
            case 'client_id':
                settings.client_id = setting.value
                break
            case 'client_secret':
                settings.client_secret = setting.value
                break
            case 'api_key':
                settings.api_key = setting.value
                break
            case 'token_expiry':
                settings.token_expiry = setting.value as unknown as number
                break
            case 'auth':
                if (setting.value === 'true') {
                    settings.auth = true
                } else {
                    settings.auth = false
                }
                break
        }
    }
}
