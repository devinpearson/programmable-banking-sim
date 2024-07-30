import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const cardData: Prisma.CardCreateInput[] = [
    { cardKey: '700615', cardNumber: '402167XXXXXX1111', isProgrammable: true, status: 'Active', cardTypeCode: 'vgs', accountId: '4675778129910189600000003', accountNumber: '10012420003' },
  ]

export async function seedCards() {
    for (const c of cardData) {
        const card = await prisma.card.create({
        data: c,
        })
        console.log(`Created card with id: ${card.cardKey}`)
    }
}