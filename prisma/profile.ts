import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const profileData: Prisma.ProfileCreateInput[] = [
  {
    profileId: '10001234567890',
    profileName: 'Joe Soap',
  },
]

export async function seedProfiles() {
  for (const p of profileData) {
    const profile = await prisma.profile.create({
      data: p,
    })
    console.log(`Created profile with id: ${profile.profileId}`)
  }
}