import { test as base, expect, type Page } from '@playwright/test';

/** Fails the test on any console error/warning or uncaught page error. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if ((m.type() === 'error' || m.type() === 'warning') && !IGNORED_CONSOLE?.test(m.text())) errors.push(`[${m.type()}] ${m.text()}`);
      });
      page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
      await use(errors);
      expect(errors, 'console errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * For a run against a hosted site from a network that interferes (an antivirus web filter, a company proxy):
 *   E2E_IGNORE_CONSOLE  a pattern of console messages that are the network's, not the app's
 *                       (for example ERR_CERT_COMMON_NAME_INVALID);
 *   E2E_SHORT_STREAMS=1 start with short live streams instead of first detecting that streams are held back.
 */
const IGNORED_CONSOLE = process.env.E2E_IGNORE_CONSOLE ? new RegExp(process.env.E2E_IGNORE_CONSOLE) : null;
const SHORT_STREAMS = process.env.E2E_SHORT_STREAMS === '1';

/** The demo customer's session id (see src/lib/session.ts). */
const SESSION = 'C-2003418762';

/**
 * Fresh start: English, light theme, presenter hidden, demo data reset on the server.
 * `path` is a full URL path: the customer app lives under /app, the staff app at /staff, the start page at /.
 * The customer is signed in unless `signedIn: false`.
 */
export async function fresh(page: Page, path = '/app', { signedIn = true } = {}) {
  await page.addInitScript(
    ({ session, signedIn, shortStreams }) => {
      if (shortStreams) sessionStorage.setItem('engie-demo-short-streams', '1');
      if (sessionStorage.getItem('e2e-init')) return;
      sessionStorage.setItem('e2e-init', '1');
      sessionStorage.setItem('engie-demo-started', '1');
      localStorage.clear();
      localStorage.setItem('engie-demo-lang', 'en');
      if (signedIn) localStorage.setItem('engie-demo-session', session);
    },
    { session: SESSION, signedIn, shortStreams: SHORT_STREAMS },
  );
  const r = await page.request.post('/api/demo/reset');
  expect(r.ok(), 'demo reset').toBe(true);
  await page.goto(path);
}

/** Open Eva from the button in the middle of the customer app's tab bar. */
export async function openEva(page: Page) {
  await page.locator('.app-eva').click();
  await expect(page.locator('.chat-widget')).toBeVisible();
}

/** Send a question in the open chat panel and wait for the reply. */
export async function ask(page: Page, question: string) {
  const before = await page.locator('.msg.bot').count();
  await page.locator('.chat-input textarea').fill(question);
  await page.keyboard.press('Enter');
  // Wait for the reply itself; the typing dots can come and go between two checks under load.
  await expect(page.locator('.msg.bot')).toHaveCount(before + 1, { timeout: 8000 });
  await expect(page.locator('.typing')).toHaveCount(0);
  return page.locator('.msg.bot .bubble').last();
}

export const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
