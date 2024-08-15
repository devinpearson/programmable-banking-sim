import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const settingData: Prisma.SettingCreateInput[] = [
  { name: 'client_id', value: 'yAxzQRFX97vOcyQAwluEU6H6ePxMA5eY' },
  { name: 'client_secret', value: '4dY0PjEYqoBrZ99r' },
  {
    name: 'api_key',
    value:
      'eUF4elFSRlg5N3ZPY3lRQXdsdUVVNkg2ZVB4TUE1ZVk6YVc1MlpYTjBaV010ZW1FdGNHSXRZV05qYjNWdWRITXRjMkZ1WkdKdmVBPT0=',
  },
  { name: 'auth', value: 'false' },
  { name: 'token_expiry', value: '1799' },
]

export async function seedSettings() {
  for (const c of settingData) {
    const setting = await prisma.setting.create({
      data: c,
    })
    console.log(`Created setting with id: ${setting.name}`)
  }
}
