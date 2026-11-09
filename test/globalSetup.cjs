// Builds a fresh, fully-seeded SQLite database for the test run so the suite is
// deterministic and independent of the developer's dev.db. Runs once before all
// test files.
const path = require('node:path')
const fs = require('node:fs')
const { execSync } = require('node:child_process')

module.exports = async () => {
  const projectRoot = path.resolve(__dirname, '..')
  const testDbPath = path.resolve(projectRoot, 'prisma', 'test.db')
  const url = `file:${testDbPath}`

  // Start from a clean slate.
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    try {
      fs.unlinkSync(testDbPath + suffix)
    } catch {
      // not present – fine
    }
  }

  const env = { ...process.env, DATABASE_URL: url }
  const run = cmd =>
    execSync(cmd, { cwd: projectRoot, env, stdio: 'inherit' })

  run('npx prisma migrate deploy')
  run('npx prisma db seed')
}
