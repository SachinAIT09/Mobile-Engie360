import { test as base, expect, type Page } from '@playwright/test';

/** Fails the test on any console error/warning or uncaught page error. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
      });
      page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
      await use(errors);
      expect(errors, 'console errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Fresh start: English, light theme, presenter hidden. */
export async function fresh(page: Page, path = '/') {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e-init')) return;
    sessionStorage.setItem('e2e-init', '1');
    localStorage.clear();
    localStorage.setItem('engie-demo-lang', 'en');
  });
  await page.goto(path);
}

/** Send a question in the open chat panel and wait for the reply. */
export async function ask(page: Page, question: string) {
  const before = await page.locator('.msg.bot').count();
  await page.locator('.chat-input textarea').fill(question);
  await page.keyboard.press('Enter');
  await expect(page.locator('.typing')).toBeVisible();
  await expect(page.locator('.typing')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('.msg.bot')).toHaveCount(before + 1);
  return page.locator('.msg.bot .bubble').last();
}

export const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
