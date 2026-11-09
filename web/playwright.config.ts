import { defineConfig, devices } from '@playwright/test';
import { API_PORT, API_URL, WEB_PORT, WEB_URL } from './tests/e2e/servers';

// End-to-end tests run the real API and web app on spare ports, so they never
// touch the dev servers (3000/3001) or the dev database: the API gets a fresh
// seeded SQLite file (prisma/e2e.db, gitignored) on every run.
const E2E_DB = 'DATABASE_URL=file:./e2e.db';

export default defineConfig({
  testDir: './tests/e2e',
  // The tests share one sandbox database, so they run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: [
        'rm -f prisma/e2e.db prisma/e2e.db-journal',
        `${E2E_DB} npx prisma migrate deploy`,
        `${E2E_DB} npx prisma db seed`,
        `${E2E_DB} PORT=${API_PORT} WEB_URL=${WEB_URL} npx tsx src/index.ts`,
      ].join(' && '),
      cwd: '..',
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      // Its own build folder, so a running `npm run dev` (which uses .next)
      // isn't clobbered by the test server.
      command: `NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_API_BASE_URL=${API_URL} npx next dev --port ${WEB_PORT}`,
      url: `${WEB_URL}/login`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
