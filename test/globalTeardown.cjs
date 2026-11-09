// Removes the test database after the run so it never lingers or gets committed.
const path = require('node:path')
const fs = require('node:fs')

module.exports = async () => {
  const testDbPath = path.resolve(__dirname, '..', 'prisma', 'test.db')
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    try {
      fs.unlinkSync(testDbPath + suffix)
    } catch {
      // nothing to clean up
    }
  }
}
