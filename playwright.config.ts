import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the whole demo flow. Uses the locally installed Chrome (no browser download).
 * `npm run e2e` starts the full server (API + frontend) on 5190 with its own data, or reuses one there.
 * Set BASE_URL to test another server, e.g. the production build on :3000.
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
    : {
        // The full ENGIE360 server (API, live events, push, frontend via Vite) with its own data file.
        command: 'npx tsx server/index.ts',
        env: { PORT: String(port), DATA_DIR: '.data-e2e' },
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 90_000,
      },
});
