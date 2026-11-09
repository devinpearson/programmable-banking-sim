/** @type {import('jest').Config} */
const config = {
  verbose: true,
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  // Point every worker at an isolated test DB before the app is imported.
  setupFiles: ['<rootDir>/test/setup-env.cjs'],
  // Build/tear down that DB once around the whole run.
  globalSetup: '<rootDir>/test/globalSetup.cjs',
  globalTeardown: '<rootDir>/test/globalTeardown.cjs',
  // SQLite file DB: keep writes serialized to avoid cross-worker contention.
  maxWorkers: 1,
}

export default config
