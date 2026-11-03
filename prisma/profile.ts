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
    const profile = await prisma.profile.upsert({
      where: { profileId: p.profileId },
      update: { profileName: p.profileName },
      create: p,
    })
    console.log(`Seeded profile with id: ${profile.profileId}`)
  }
}