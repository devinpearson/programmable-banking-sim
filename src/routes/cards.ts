import express from 'express'
const router = express.Router()
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import dayjs from 'dayjs'
import {
  formatResponse,
  formatErrorResponse,
  emitDatabaseSummary,
} from '../app.js'
import { getAccountBalance } from '../balance.js'
import { HOME_CURRENCY, toRand } from '../fx.js'
import { STARTER_CARD_CODE, generateCardNumber } from '../cardCode.js'
import { accountAllowed } from '../consent.js'
import { validateRequest, validatedBody } from '../middleware/validation.js'
import {
  cardCodeBody,
  cardStatusBody,
  createCardBody,
  environmentVariablesBody,
  executeCodeBody,
  executeLiveBody,
  toggleProgrammableBody,
} from '../schema/requestSchemas.js'
import {
  InvestecTransactionType,
  TransactionStatus,
  TransactionType,
} from '../types.js'
import { v4 as uuidv4 } from 'uuid'
import emu from 'programmable-card-code-emulator'
import type { ExecutionItem } from '../types.js'

interface CardResponse {
  CardKey: string
  CardNumber: string
  IsProgrammable: boolean
  status: string
  CardTypeCode: string
  AccountNumber: string
  AccountId: string
}

// A 3-legged token only reaches cards on accounts the user consented to.
// Unknown cards fall through to the route's own 404.
router.param('cardKey', async (req, res, next, cardKey: string) => {
  try {
    const card = await prisma.card.findUnique({ where: { cardKey } })
    if (card && !accountAllowed(res, card.accountId)) {
      return formatErrorResponse(req, res, 403, 'Card account not consented for this token')
    }
    next()
  } catch (error) {
    next(error)
  }
})

router.get('/', async (req, res) => {
  try {
    const result = (await prisma.card.findMany()).filter(card =>
      accountAllowed(res, card.accountId),
    )
    const cards: CardResponse[] = []
    result.forEach(card => {
      cards.push({
        CardKey: card.cardKey,
        CardNumber: card.cardNumber,
        IsProgrammable: card.isProgrammable,
        status: card.status,
        CardTypeCode: card.cardTypeCode,
        AccountNumber: card.accountNumber,
        AccountId: card.accountId,
      })
    })
    return formatResponse({ cards }, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// Sandbox: issue a card. Given an accountId, the card is linked to that
// account (it must exist) and swipes against its balance; the account number
// comes from the account. Without one, the card links to no account and
// swipes only run its code. Unset fields get defaults: a masked card number,
// status Active, and the starter code saved and published.
router.post('/', validateRequest({ body: createCardBody }), async (req, res) => {
  try {
    const body = validatedBody(res, createCardBody)
    const account = body.accountId
      ? await prisma.account.findUnique({ where: { accountId: body.accountId } })
      : null
    if (body.accountId && !account) {
      return formatErrorResponse(req, res, 422, `No account with id ${body.accountId}`)
    }
    const savedCodeId = uuidv4()
    const publishedCodeId = uuidv4()
    const card = {
      cardKey: body.cardKey || uuidv4(),
      cardNumber: body.cardNumber ?? generateCardNumber(),
      isProgrammable: body.isProgrammable ?? false,
      status: body.status ?? 'Active',
      cardTypeCode: body.cardTypeCode ?? 'vgs',
      // An unlinked card keeps the old placeholder account fields.
      accountId: account?.accountId ?? '1234567890',
      accountNumber: body.accountNumber ?? account?.accountNumber ?? '1234567890',
      publishedCode: publishedCodeId,
      savedCode: savedCodeId,
      envs: '{}',
    }
    const cardcheck = await prisma.card.findFirst({
      where: { cardKey: card.cardKey },
    })
    if (cardcheck) {
      return formatErrorResponse(req, res, 409, `A card with key ${card.cardKey} already exists`)
    }
    const now = new Date()
    await prisma.cardCode.createMany({
      data: [
        { codeId: savedCodeId, code: STARTER_CARD_CODE, createdAt: now, updatedAt: now },
        { codeId: publishedCodeId, code: STARTER_CARD_CODE, createdAt: now, updatedAt: now, publishedAt: now },
      ],
    })
    await prisma.card.create({ data: card })
    await emitDatabaseSummary()

    return formatResponse(card, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.delete('/:cardKey', async (req, res) => {
  try {
    const cardKey = req.params.cardKey
    // check that the account exists
    const card = await prisma.card.findFirst({
      where: {
        cardKey: cardKey,
      },
    })
    if (!card) {
      console.log('no card found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    if (card.savedCode) await prisma.cardCode.deleteMany({ where: { codeId: card.savedCode } })
    if (card.publishedCode) await prisma.cardCode.deleteMany({ where: { codeId: card.publishedCode } })
    await prisma.card.delete({ where: { cardKey: cardKey } })
    return res.status(200).json()
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/:cardKey/code', async (req, res) => {
  try {
    const cardKey = req.params.cardKey
    // check that the card exists
    const card = await prisma.card.findFirst({
      where: {
        cardKey: cardKey,
      },
    })
    if (!card) {
      console.log('no card found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    const cardCode = await prisma.cardCode.findFirst({
      where: {
        codeId: card.savedCode,
      },
    })
    return formatResponse({ cardCode }, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.post('/:cardKey/code', validateRequest({ body: cardCodeBody }), async (req, res) => {
  try {
    const cardKey = req.params.cardKey
    // check that the card exists
    const card = await prisma.card.findFirst({
      where: {
        cardKey: cardKey,
      },
    })
    if (!card) {
      console.log('no card found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    const { code } = validatedBody(res, cardCodeBody)
    const cardCode = await prisma.cardCode.update({
      where: {
        codeId: card.savedCode,
      },
      data: {
        code: code,
      },
    })
    return formatResponse({ cardCode }, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/:cardKey/publishedcode', async (req, res) => {
  try {
    const cardKey = req.params.cardKey
    // check that the card exists
    const card = await prisma.card.findFirst({
      where: {
        cardKey: cardKey,
      },
    })
    if (!card) {
      console.log('no card found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    const cardCode = await prisma.cardCode.findFirst({
      where: {
        codeId: card.publishedCode,
      },
    })
    return formatResponse({ cardCode }, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.post('/:cardKey/publishedcode', validateRequest({ body: cardCodeBody }), async (req, res) => {
  try {
    const cardKey = req.params.cardKey
    // check that the card exists
    const card = await prisma.card.findFirst({
      where: {
        cardKey: cardKey,
      },
    })
    if (!card) {
      console.log('no card found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    const { code } = validatedBody(res, cardCodeBody)

    const cardCode = await prisma.cardCode.update({
      where: {
        codeId: card.publishedCode,
      },
      data: {
        code: code,
      },
    })
    const data = { cardCode }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

// Sandbox control: stop or reactivate a card. Not a real Investec endpoint.
// Body: { "status": "Active" | "Stopped" } (any case).
router.post('/:cardKey/status', validateRequest({ body: cardStatusBody }), async (req, res) => {
  try {
    const cardKey = req.params.cardKey
    const card = await prisma.card.findFirst({ where: { cardKey } })
    if (!card) {
      return formatErrorResponse(req, res, 404)
    }
    const { status } = validatedBody(res, cardStatusBody)
    await prisma.card.update({ where: { cardKey }, data: { status } })
    return formatResponse({ cardKey, status }, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.post(
  '/:cardKey/toggle-programmable-feature',
  validateRequest({ body: toggleProgrammableBody }),
  async (req, res) => {
    try {
      const cardKey = req.params.cardKey
      // check that the card exists
      const card = await prisma.card.findFirst({
        where: {
          cardKey: cardKey,
        },
      })
      if (!card) {
        console.log('no card found')
        return formatErrorResponse(req, res, 404) // no account was found
      }
      const enabled = validatedBody(res, toggleProgrammableBody).Enabled
      await prisma.card.update({
        where: {
          cardKey: cardKey,
        },
        data: {
          isProgrammable: enabled,
        },
      })
      return res.json({ Enabled: enabled })
    } catch (error) {
      console.log(error)
      return formatErrorResponse(req, res, 500)
    }
  },
)

router.get(
  '/:cardKey/environmentvariables',
  async (req, res) => {
    try {
      const cardKey = req.params.cardKey
      // check that the card exists
      const card = await prisma.card.findFirst({
        where: {
          cardKey: cardKey,
        },
      })
      if (!card) {
        console.log('no card found')
        return formatErrorResponse(req, res, 404) // no account was found
      }
      if (card.envs === null) {
        card.envs = '{}'
      }
      const data = {
        result: {
          variables: JSON.parse(card.envs),
          createdAt: '2023-06-27T07:18:12.086Z',
          updatedAt: '2023-06-27T07:18:12.086Z',
          error: null,
        },
      }

      return formatResponse(data, req, res)
    } catch (error) {
      console.log(error)
      return formatErrorResponse(req, res, 500)
    }
  },
)

router.post(
  '/:cardKey/environmentvariables',
  validateRequest({ body: environmentVariablesBody }),
  async (req, res) => {
    try {
      const cardKey = req.params.cardKey
      // check that the card exists
      const card = await prisma.card.findFirst({
        where: {
          cardKey: cardKey,
        },
      })
      if (!card) {
        console.log('no card found')
        return formatErrorResponse(req, res, 404) // no account was found
      }
      const vars = JSON.stringify(validatedBody(res, environmentVariablesBody).variables)
      await prisma.card.update({
        where: {
          cardKey: cardKey,
        },
        data: {
          envs: vars,
        },
      })
      const data = {
        result: {
          variables: JSON.parse(vars),
          createdAt: '2023-06-27T07:18:12.086Z',
          updatedAt: '2023-06-27T07:18:12.086Z',
          error: null,
        },
      }
      return formatResponse(data, req, res)
    } catch (error) {
      console.log(error)
      return formatErrorResponse(req, res, 500)
    }
  },
)

router.post('/:cardKey/code/execute', validateRequest({ body: executeCodeBody }), async (req, res) => {
  try {
    const cardKey = req.params.cardKey
    // check that the card exists
    const card = await prisma.card.findFirst({
      where: {
        cardKey: cardKey,
      },
    })
    if (!card) {
      console.log('no card found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    const simulationPayload = validatedBody(res, executeCodeBody)
    const code = simulationPayload.simulationcode
    const transaction = emu.createTransaction(
      simulationPayload.currencyCode,
      simulationPayload.centsAmount, // Amount in cents
      simulationPayload.merchantCode, // Merchant code (MCC)
      simulationPayload.merchantName, // Merchant Name
      simulationPayload.merchantCity, // City
      simulationPayload.countryCode, // Country code
    )

    const result = await emu.run(transaction, code, card.envs)
    // console.log(result)
    for (const element of result) {
      // console.log(element)
      await prisma.cardExecution.create({
        data: {
          executionId: element.executionId,
          cardKey: cardKey,
          rootCodeFunctionId: element.rootCodeFunctionId,
          sandbox: element.sandbox,
          type: element.type,
          authorizationApproved: element.authorizationApproved,
          smsCount: element.smsCount,
          emailCount: element.emailCount,
          pushNotificationCount: element.pushNotificationCount,
          createdAt: element.createdAt,
          startedAt: element.startedAt,
          completedAt: element.completedAt,
          updatedAt: element.updatedAt,
        },
      })
      for (const logItem of element.logs) {
        await prisma.cardExecutionLog.create({
          data: {
            logId: uuidv4(),
            executionId: element.executionId,
            level: logItem.level,
            content: logItem.content,
            createdAt: logItem.createdAt,
          },
        })
      }
    }

    const data = { result }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.post(
  '/:cardKey/code/execute-live',
  validateRequest({ body: executeLiveBody }),
  async (req, res) => {
    try {
      const cardKey = req.params.cardKey
      // check that the card exists
      const card = await prisma.card.findFirst({
        where: {
          cardKey: cardKey,
        },
      })
      if (!card) {
        console.log('no card found')
        return formatErrorResponse(req, res, 404) // no account was found
      }
      const cardCode = await prisma.cardCode.findFirst({
        where: {
          codeId: card.publishedCode,
        },
      })
      const simulationPayload = validatedBody(res, executeLiveBody)
      const code = cardCode?.code ?? ''
      // The card code sees the purchase in its own currency; the account is
      // charged in rand at the sandbox exchange rate.
      const conversion = await toRand(simulationPayload.currencyCode, simulationPayload.centsAmount)
      if (!conversion) {
        const currency = simulationPayload.currencyCode.toUpperCase()
        return formatErrorResponse(
          req,
          res,
          422,
          `No exchange rate for ${currency}. Add one with PUT /exchange-rates/${currency}.`,
        )
      }
      const amount = conversion.zarAmount
      // Reported for foreign purchases only.
      const exchange = conversion.currencyCode === HOME_CURRENCY ? null : conversion
      // A stopped (or otherwise inactive) card is declined by the bank before
      // any card code runs.
      if (card.status.toLowerCase() !== 'active') {
        return formatResponse(
          { result: false, reason: 'card_not_active', transaction: null, exchange },
          req,
          res,
        )
      }
      // A card linked to a real account swipes against that account: the bank
      // declines it up front when the available balance can't cover it, and
      // an approved swipe places a pending hold on the account. Cards that
      // point at no account (e.g. created with the defaults) just run code.
      const balance = await getAccountBalance(card.accountId)
      if (balance && amount > balance.availableBalance) {
        return formatResponse(
          { result: false, reason: 'insufficient_funds', transaction: null, exchange },
          req,
          res,
        )
      }
      const transaction = emu.createTransaction(
        simulationPayload.currencyCode,
        simulationPayload.centsAmount, // Amount in cents
        simulationPayload.merchantCode, // Merchant code (MCC)
        simulationPayload.merchantName, // Merchant Name
        simulationPayload.merchantCity, // City
        simulationPayload.countryCode, // Country code
      )
      const result = await emu.run(transaction, code, card.envs)
      // The emulator only runs afterTransaction when beforeTransaction approved.
      const transactionResult = result.some(
        element => element.type === 'after_transaction',
      )

      for (const element of result) {
        await prisma.cardExecution.create({
          data: {
            executionId: element.executionId,
            cardKey: cardKey,
            rootCodeFunctionId: element.rootCodeFunctionId,
            sandbox: false,
            type: element.type,
            authorizationApproved:
              element.type === 'before_transaction'
                ? transactionResult
                : element.authorizationApproved,
            smsCount: element.smsCount,
            emailCount: element.emailCount,
            pushNotificationCount: element.pushNotificationCount,
            createdAt: element.createdAt,
            startedAt: element.startedAt,
            completedAt: element.completedAt,
            updatedAt: element.updatedAt,
          },
        })
        for (const logItem of element.logs) {
          await prisma.cardExecutionLog.create({
            data: {
              logId: uuidv4(),
              executionId: element.executionId,
              level: logItem.level,
              content: logItem.content,
              createdAt: logItem.createdAt,
            },
          })
        }
      }

      let posted = null
      if (transactionResult && balance) {
        const now = dayjs().format('YYYY-MM-DD')
        // By default an approved swipe is a pending hold. Pass settle: true to
        // post it straight away (an already-settled card purchase).
        const settleNow = simulationPayload.settle
        posted = await prisma.transaction.create({
          data: {
            accountId: card.accountId,
            type: TransactionType.DEBIT,
            transactionType: InvestecTransactionType.CardPurchases,
            status: settleNow ? TransactionStatus.POSTED : TransactionStatus.PENDING,
            // Foreign purchases show the original amount, as on a statement.
            description: exchange
              ? `${simulationPayload.merchantName} (${exchange.currencyCode} ${exchange.amount.toFixed(2)})`
              : simulationPayload.merchantName,
            cardNumber: card.cardNumber,
            postedOrder: 0,
            // A hold has no posting/value/action dates until it settles.
            postingDate: settleNow ? now : '',
            valueDate: settleNow ? now : '',
            actionDate: settleNow ? now : '',
            transactionDate: now,
            amount: amount,
            runningBalance: 0,
          },
        })
        await emitDatabaseSummary()
      }

      const data = { result: transactionResult, transaction: posted, exchange }
      return formatResponse(data, req, res)
    } catch (error) {
      console.log(error)
      return formatErrorResponse(req, res, 500)
    }
  },
)

router.get('/:cardKey/code/executions', async (req, res) => {
  try {
    const cardKey = req.params.cardKey
    // check that the card exists
    const card = await prisma.card.findFirst({
      where: {
        cardKey: cardKey,
      },
    })
    if (!card) {
      console.log('no card found')
      return formatErrorResponse(req, res, 404) // no account was found
    }
    const executions = await prisma.cardExecution.findMany({
      where: {
        cardKey: cardKey,
      },
    })
    const executionsArr: ExecutionItem[] =
      executions as unknown as ExecutionItem[]
    for (let i = 0; i < executionsArr.length; i++) {
      const logs = await prisma.cardExecutionLog.findMany({
        where: {
          executionId: executions[i].executionId,
        },
      })
      executionsArr[i].logs = logs
    }
    const data = { executions }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/countries', async (req, res) => {
  try {
    const result = await prisma.country.findMany()
    const data = { result }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/currencies', async (req, res) => {
  try {
    const result = await prisma.currency.findMany()
    const data = { result }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/merchants', async (req, res) => {
  try {
    const result = await prisma.merchant.findMany()
    const data = { result }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

export default router
