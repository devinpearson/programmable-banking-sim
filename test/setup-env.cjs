// Runs in every Jest worker BEFORE the app (and its PrismaClient instances) is
// imported. Points Prisma at an isolated test database so tests never touch the
// committed dev.db. dotenv (loaded by the app) does not override existing env
// vars, so this value wins.
const path = require('node:path')

const testDbPath = path.resolve(__dirname, '..', 'prisma', 'test.db')
process.env.DATABASE_URL = `file:${testDbPath}`
