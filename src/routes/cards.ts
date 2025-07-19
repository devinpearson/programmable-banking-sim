import express, { Request, Response } from 'express'
const router = express.Router()
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import { formatResponse, formatErrorResponse } from '../app.js'
import { v4 as uuidv4 } from 'uuid'
import emu from 'programmable-card-code-emulator'
import { ExecutionItem } from '../types.js'

interface CardResponse {
  CardKey: string
  CardNumber: string
  IsProgrammable: boolean
  status: string
  CardTypeCode: string
  AccountNumber: string
  AccountId: string
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await prisma.card.findMany()
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

router.post('/', async (req: Request, res: Response) => {
  try {
    let card = {
      cardKey: uuidv4(),
      cardNumber: '1234567890123456',
      isProgrammable: false,
      status: 'ACTIVE',
      cardTypeCode: 'vgs',
      accountId: '1234567890',
      accountNumber: '1234567890',
      publishedCode: '',
      savedCode: '',
      envs: '{}',
    }
    card = { ...card, ...req.body }
    if (card.cardKey === undefined || card.cardKey === '') {
      card.cardKey = uuidv4()
    }
    // check that the account exists
    const cardcheck = await prisma.card.findFirst({
      where: {
        cardKey: card.cardKey,
      },
    })
    if (cardcheck) {
      console.log('card found')
      return formatErrorResponse(req, res, 409) // account was found
    }
    // insert the transaction
    await prisma.card.create({
      data: card,
    })

    return formatResponse(card, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.delete('/:cardKey', async (req: Request, res: Response) => {
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
    // remove the transactions
    await prisma.card.delete({
      where: {
        cardKey: cardKey,
      },
    })
    return res.status(200).json()
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/:cardKey/code', async (req: Request, res: Response) => {
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

router.post('/:cardKey/code', async (req: Request, res: Response) => {
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
    let code = req.body.code
    if (code === undefined) {
      code = ''
    }
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

router.get('/:cardKey/publishedcode', async (req: Request, res: Response) => {
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

router.post('/:cardKey/publishedcode', async (req: Request, res: Response) => {
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
    let code = req.body.code
    if (code === undefined) {
      code = ''
    }

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

router.post(
  '/:cardKey/toggle-programmable-feature',
  async (req: Request, res: Response) => {
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
      let enabled = req.body.Enabled
      if (enabled !== true) {
        enabled = false
      }
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
  async (req: Request, res: Response) => {
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
  async (req: Request, res: Response) => {
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
      let vars = JSON.stringify(req.body.variables)
      if (vars === undefined) {
        vars = '{}'
      }
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

router.post('/:cardKey/code/execute', async (req: Request, res: Response) => {
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
    const simulationPayload = req.body
    let code = simulationPayload.simulationcode
    const transaction = emu.createTransaction(
      simulationPayload.currencyCode,
      simulationPayload.centsAmount, // Amount in cents
      simulationPayload.merchantCode, // Merchant code (MCC)
      simulationPayload.merchantName, // Merchant Name
      simulationPayload.merchantCity, // City
      simulationPayload.countryCode, // Country code
    )
    if (simulationPayload.simulationcode === undefined) {
      code = ''
    }

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
  async (req: Request, res: Response) => {
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
      const simulationPayload = req.body
      const code = cardCode?.code ?? ''
      const transaction = emu.createTransaction(
        simulationPayload.currencyCode,
        simulationPayload.centsAmount, // Amount in cents
        simulationPayload.merchantCode, // Merchant code (MCC)
        simulationPayload.merchantName, // Merchant Name
        simulationPayload.merchantCity, // City
        simulationPayload.countryCode, // Country code
      )
      let transactionResult = false
      const result = await emu.run(transaction, code, card.envs)

      for (const element of result) {
        if (element.type === 'after_transaction') {
          transactionResult = true
        }
        await prisma.cardExecution.create({
          data: {
            executionId: element.executionId,
            cardKey: cardKey,
            rootCodeFunctionId: element.rootCodeFunctionId,
            sandbox: false,
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

      const data = { result: transactionResult }
      return formatResponse(data, req, res)
    } catch (error) {
      console.log(error)
      return formatErrorResponse(req, res, 500)
    }
  },
)

router.get('/:cardKey/code/executions', async (req: Request, res: Response) => {
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

router.get('/countries', async (req: Request, res: Response) => {
  try {
    const result = await prisma.country.findMany()
    const data = { result }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/currencies', async (req: Request, res: Response) => {
  try {
    const result = await prisma.currency.findMany()
    const data = { result }
    return formatResponse(data, req, res)
  } catch (error) {
    console.log(error)
    return formatErrorResponse(req, res, 500)
  }
})

router.get('/merchants', async (req: Request, res: Response) => {
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
