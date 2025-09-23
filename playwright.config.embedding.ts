import { defineConfig, devices } from '@playwright/test';

/**
 * Temporary Playwright config for embedding tests with existing dev server
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run embedding tests sequentially for stability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Single worker for embedding tests
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173', // Use existing dev server
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    timeout: 60000, // 60 seconds per test
    headless: false, // Use headed mode to avoid headless shell issues
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome', // Use system Chrome instead of headless shell
      },
    },
  ],

  // No webServer config - use existing dev server running on 5174
  timeout: 180000, // 3 minutes total timeout

  // Ensure we can connect to existing server
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },
});