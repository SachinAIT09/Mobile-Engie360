import type { Browser, Page } from '@playwright/test';
import { ask, expect, fresh, test } from './fixtures';

/** The customer portal and the staff app side by side, as in the live demo. */
async function staffPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('engie-demo-lang', 'en'));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/staff');
  await expect(page.locator('.staff-conn')).toHaveClass(/live|connected|online/, { timeout: 10_000 });
  return page;
}

test.describe('customer ↔ staff, live', () => {
  test('server API is up and seeded from the mock-up', async ({ page }) => {
    await fresh(page);
    const r = await page.request.get('/api/customer');
    expect((await r.json()).customer.firstName).toBe('Sanne');
    const msgs = await (await page.request.get('/api/messages')).json();
    expect(msgs).toHaveLength(4);
  });

  test('installment change shows up in the staff activity feed', async ({ page, browser }) => {
    await fresh(page, '/billing?adjust=1');
    const staff = await staffPage(browser);
    await page.locator('.modal input[type=range]').fill('210');
    await page.getByRole('button', { name: /Confirm/ }).click();
    await expect(staff.locator('.staff-feed')).toContainText('Changed installment to €210 from December', { timeout: 8000 });
    // Survives a reload: it came from the server, not page state.
    await page.reload();
    await expect(page.locator('body')).toContainText('210');
    await staff.context().close();
  });

  test('Eva conversations appear live for staff', async ({ page, browser }) => {
    await fresh(page);
    const staff = await staffPage(browser);
    await page.locator('.chat-fab').click();
    await ask(page, 'Why is my energy bill higher this month?');
    await expect(staff.locator('.staff-thread')).toContainText('Why is my energy bill higher this month?', { timeout: 8000 });
    await expect(staff.locator('.staff-thread')).toContainText('12% higher');
    await staff.context().close();
  });

  test('a staff message arrives in the customer app as a banner and in the inbox', async ({ page, browser }) => {
    await fresh(page);
    const staff = await staffPage(browser);
    await staff.locator('.staff-template').first().click();
    await staff.getByRole('button', { name: /^Send$/ }).click();
    await expect(staff.locator('.toast').last()).toContainText('Sent');
    await expect(page.locator('.toast').last()).toContainText('Cheapest hours tonight', { timeout: 8000 });
    await page.getByRole('button', { name: /Notifications/ }).click();
    await expect(page.locator('.popover')).toContainText('Cheapest hours tonight');
    await staff.context().close();
  });

  test('reset from the staff app restores the customer app', async ({ page, browser }) => {
    await fresh(page);
    await page.request.post('/api/installment', { data: { amount: 230 } });
    const staff = await staffPage(browser);
    staff.once('dialog', (d) => void d.accept()); // "Reset the demo?" confirmation
    await staff.getByRole('button', { name: /Reset demo/ }).click();
    await expect.poll(async () => (await (await page.request.get('/api/billing')).json()).installment.pending).toBeNull();
    await staff.context().close();
  });

  test('start page links every app and shows the phone QR', async ({ page }) => {
    await fresh(page, '/');
    await expect(page.locator('h1')).toHaveText('ENGIE360 demo');
    await expect(page.locator('img[alt="PowerConnect.AI"]')).toBeVisible();
    for (const href of ['/staff', '/app', '/app/mobile-preview']) await expect(page.locator(`a[href="${href}"]`)).toBeVisible();
    await expect(page.locator('.phone svg')).toBeVisible();
    await expect(page.locator('.phone code')).toContainText('/app');
    // The old address still works.
    await page.goto('/start');
    await expect(page).toHaveURL(/\/$/);
  });
});
