import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const cardCodeData: Prisma.CardCodeCreateInput[] = [
  {
    codeId: '3BB77753-R2D2-4U2B-1A2B-4C213E7D0AC3',
    code: '// This function runs before a transaction.\nconst beforeTransaction = async (authorization) => {\n  console.log(authorization);\n};\n// This function runs after a transaction was successful.\nconst afterTransaction = async (transaction) => {\n  console.log(transaction);\n};\n// This function runs after a transaction was declined.\nconst afterDecline = async (transaction) => {\n  console.log(transaction);\n};',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: new Date(),
  },
  {
    codeId: 'DC5A7EE9-DD2A-4327-9305-78B9185890CA',
    code: '// This function runs before a transaction.\nconst beforeTransaction = async (authorization) => {\n  console.log(authorization);\n};\n// This function runs after a transaction was successful.\nconst afterTransaction = async (transaction) => {\n  console.log(transaction);\n};\n// This function runs after a transaction was declined.\nconst afterDecline = async (transaction) => {\n  console.log(transaction);\n};',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: new Date(),
  },
]

export async function seedCardCodes() {
  for (const c of cardCodeData) {
    const cardCode = await prisma.cardCode.create({
      data: c,
    })
    console.log(`Created card with id: ${cardCode.codeId}`)
  }
}
