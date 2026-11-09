// Runs in every Jest worker BEFORE the app (and its PrismaClient instances) is
// imported. Points Prisma at an isolated test database so tests never touch the
// committed dev.db. dotenv (loaded by the app) does not override existing env
// vars, so this value wins.
const path = require('node:path')

const testDbPath = path.resolve(__dirname, '..', 'prisma', 'test.db')
process.env.DATABASE_URL = `file:${testDbPath}`

// Turn off HTTP keep-alive for the test client. supertest starts a fresh
// server on a random port for every request and closes it afterwards. Node
// 19+ keeps client connections alive by default, so when the OS happens to
// hand a new server the same port as a recently closed one, the agent reuses
// the dead pooled connection and the request fails with "socket hang up" /
// ECONNRESET — a random test failing roughly once every 10–15 runs.
const http = require('node:http')
http.globalAgent = new http.Agent({ keepAlive: false })
