import express, { Request, Response } from 'express'
import morgan from 'morgan'
import cors from 'cors'
import dayjs from 'dayjs'
import dotenv from 'dotenv'
import { Server } from 'socket.io'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createServer } from 'node:http'
import identity from './routes/identity.js'
import accounts from './routes/accounts.js'
import cards from './routes/cards.js'
import {
  AccessToken,
  AuthorizationCode,
  Settings,
  ControlMessage,
  SettingType,
} from './types.js'
import { seedAccounts } from '../prisma/account.js'
import { seedTransactions } from '../prisma/transaction.js'
import { seedBeneficiaries } from '../prisma/beneficiary.js'
import { seedCards } from '../prisma/card.js'
import { seedCardCodes } from '../prisma/card-code.js'
import { deleteAllAccounts, deleteAllBeneficiaries, deleteAllCardCode, deleteAllCards, deleteAllTransactions, getSettings, updateSetting } from './db.js'

dotenv.config()

export const port = process.env.PORT || 3000
// const dbFile = process.env.DB_FILE || 'investec.db'
// const overdraft = process.env.OVERDRAFT || 5000
export const app = express()
export const server = createServer(app)
const io = new Server(server)
export let settings = {} as Settings
await fetchSettings()

app.use(cors())
// Configuring body parser middleware
app.use(express.urlencoded({ extended: false }))
app.use(morgan('combined'))
app.use(express.json())
app.use(express.static('public'))

export const accessTokens = {} as Record<string, AccessToken>
export const authorizationCodes = {} as Record<string, AuthorizationCode>
export const refreshTokens = [] as string[]

const __dirname = dirname(fileURLToPath(import.meta.url))

const messageQueue = 'logs'

io.on('connection', socket => {
  socket.on('envs', msg => {
    console.log('message: ' + msg)
    settings = msg
    io.emit('envs', settings)
  })
  socket.on('control', async (msg: ControlMessage) => {
    console.log('control: ' + msg)
    const { action } = msg // , message
    console.log('action: ' + action)
    switch (action) {
      case 'clear':
        await deleteAllAccounts()
        await deleteAllTransactions()
        await deleteAllBeneficiaries()
        await deleteAllCards()
        await deleteAllCardCode()
        break
      case 'restore':
        await deleteAllAccounts()
        await deleteAllTransactions()
        await deleteAllBeneficiaries()
        await deleteAllCards()
        await deleteAllCardCode()
        seedAccounts()
        seedTransactions()
        seedBeneficiaries()
        seedCards()
        seedCardCodes()
        break
    }
    //io.emit('control', settings);
  })
  socket.on(messageQueue, msg => {
    console.log('message: ' + msg)
    io.emit(messageQueue, msg)
  })
  console.log('a user connected')
  socket.on('disconnect', () => {
    console.log('user disconnected')
  })
})

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'))
})

app.get('/login', (req, res) => {
  res.sendFile(join(__dirname, 'login.html'))
})

app.post('/login', (req, res) => {
  const email = req.body.email
  const password = req.body.password
  if (email === 'admin@example.com' && password === 'admin') {
    return res.redirect('/wpaas/prog-banking-wpaas/oauth-consent')
  } else {
    return res.redirect('/login')
  }
})

// screen where the scopes and accounts are selected
app.get(
  '/wpaas/prog-banking-wpaas/oauth-consent',
  (req: Request, res: Response) => {
    res.sendFile(join(__dirname, 'oauth-consent.html'))
  },
)

app.get('/guide', (req, res) => {
  res.sendFile(join(__dirname, 'guide.html'))
})


app.post('/envs', async (req: Request, res: Response) => {
    await updateSetting(SettingType.CLIENT_ID, req.body.client_id)
    await updateSetting(SettingType.CLIENT_SECRET, req.body.client_secret)
    await updateSetting(SettingType.API_KEY, req.body.api_key)
    await updateSetting(SettingType.TOKEN_EXPIRY, req.body.token_expiry as unknown as string)
    await updateSetting(SettingType.AUTH, (req.body.auth)? true:false)
  
    settings = req.body
    return res.json(settings)
})

app.use('/identity', identity)
// middleware to check the token
app.use('/za', (req, res, next) => {
  if (!isValidToken(req)) {
    return formatErrorResponse(req, res, 401)
  }
  next()
})

app.use('/za/pb/v1/accounts', accounts)
app.use('/za/v1/cards', cards)

app.delete('/clear', async (req: Request, res: Response) => {
  try {
    // delete the accounts
    await deleteAllAccounts()
    // delete the transactions
    await deleteAllTransactions()
    // delete the beneficiaries
    await deleteAllBeneficiaries()

    return res.status(200).json()
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

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

function isValidToken(req: Request) {
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
  if (
    accessTokens[authorization] &&
    dayjs().isBefore(accessTokens[authorization].expires_at)
  ) {
    return true
  }

  return false
}

export function formatResponse (data: unknown, req: Request, res: Response) {
  const date = new Date()
  io.sockets.emit(
    messageQueue,
    date.toUTCString() +
      ' ' +
      req.method +
      ' ' +
      req.url +
      ' HTTP/' +
      req.httpVersion +
      ' ' +
      res.statusCode,
  )
  return res.json({
    data,
    links: {
      self: req.protocol + '://' + req.get('host') + req.originalUrl,
    },
    meta: {
      totalPages: 1,
    },
  })
}
export function formatErrorResponse(req: Request, res: Response, code: number) {
  const date = new Date()
  io.sockets.emit(
    messageQueue,
    date.toUTCString() +
      ' ' +
      req.method +
      ' ' +
      req.url +
      ' HTTP/' +
      req.httpVersion +
      ' ' +
      code,
  )
  return res.status(code).json()
}

async function fetchSettings() {
  const dbSettings = await getSettings()
  for (let i = 0; i < dbSettings.length; i++) {
    const setting = dbSettings[i]
    if (setting) {
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
}
