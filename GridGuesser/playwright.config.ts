import { defineConfig } from '@playwright/test';

/**
 * Playwright config for GridGuesser E2E tests.
 *
 * The `webServer` block auto-starts both the Next.js frontend (port 3000)
 * and the Express + Socket.IO backend (port 3001) with GRIDGUESSER_TEST_MODE=1
 * so the image-fetch step uses the local SVG fixture pair instead of
 * Google Custom Search.
 *
 * Tests run with workers: 1 because they share a single DynamoDB table and
 * many tests need two browser contexts (host + joiner) that talk through
 * the same backend instance. Parallel test runs would race for room codes
 * and produce flaky results.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run server',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: true,
      timeout: 120_000,
      env: { GRIDGUESSER_TEST_MODE: '1' },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
