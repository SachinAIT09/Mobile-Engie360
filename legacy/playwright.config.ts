import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the whole demo flow. Uses the locally installed Chrome (no browser download).
 * `npm run e2e` starts its own dev server on 5190, or reuses one already running there.
 * Set BASE_URL to test another server (e.g. `npm run preview`).
 */
const port = 5190;
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [['list']],
  use: {
    baseURL,
    channel: 'chrome',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome', viewport: { width: 390, height: 844 } }, testMatch: /mobile\.spec/ },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: `npx vite --port ${port} --strictPort`, url: baseURL, reuseExistingServer: true, timeout: 60_000 },
});
