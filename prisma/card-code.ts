import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const cardCodeData: Prisma.CardCodeCreateInput[] = [
    { codeId: '3BB77753-R2D2-4U2B-1A2B-4C213E7D0AC3', code: '', createdAt: new Date(), updatedAt: new Date(), publishedAt: new Date() },
  ]

export async function seedCardCodes() {
    for (const c of cardCodeData) {
        const cardCode = await prisma.cardCode.create({
        data: c,
        })
        console.log(`Created card with id: ${cardCode.codeId}`)
    }
}