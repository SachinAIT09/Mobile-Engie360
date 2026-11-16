import type { Browser, Page } from '@playwright/test';
import { ask, expect, fresh, openEva, test } from './fixtures';

// The customer app runs at phone size (as on a real phone); the staff app gets its own laptop-size window below.
test.use({ viewport: { width: 390, height: 844 } });

/** The customer portal and the staff app side by side, as in the live demo. */
async function staffPage(browser: Browser, path = '/staff'): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('engie-demo-lang', 'en'));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto(path);
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
    await fresh(page, '/app/billing?adjust=1');
    const staff = await staffPage(browser);
    await page.locator('.modal input[type=range]').fill('210');
    await page.getByRole('button', { name: /Confirm/ }).click();
    await expect(staff.locator('.staff-feed')).toContainText('Changed installment to €210 from December', { timeout: 8000 });
    await expect(staff.locator('.badge', { hasText: 'In the app now' })).toBeVisible();
    // The Customer activity table has it too, under the Billing filter.
    await staff.getByRole('link', { name: 'Customer activity' }).click();
    await staff.locator('.pills').getByRole('button', { name: 'Billing' }).click();
    await expect(staff.locator('.staff-table tbody tr')).toHaveCount(1);
    // Survives a reload: it came from the server, not page state.
    await page.reload();
    await expect(page.locator('body')).toContainText('210');
    await staff.context().close();
  });

  test('Eva conversations appear live for staff', async ({ page, browser }) => {
    await fresh(page);
    const staff = await staffPage(browser, '/staff/conversations');
    await openEva(page);
    await ask(page, 'Why is my energy bill higher this month?');
    await expect(staff.locator('.staff-thread')).toContainText('Why is my energy bill higher this month?', { timeout: 8000 });
    await expect(staff.locator('.staff-thread')).toContainText('12% higher');
    await staff.context().close();
  });

  test('a staff message arrives in the customer app as a banner and in the inbox', async ({ page, browser }) => {
    await fresh(page);
    const staff = await staffPage(browser, '/staff/demo');
    await expect(staff.locator('.badge', { hasText: 'Sanne is in the app' })).toBeVisible();
    await staff.locator('.send-card', { hasText: 'Cheapest hours tonight' }).click();
    await expect(staff.locator('.toast').last()).toContainText('Sent');
    await expect(page.locator('.toast').last()).toContainText('Cheapest hours tonight', { timeout: 8000 });
    await page.getByRole('button', { name: /Notifications/ }).click();
    await expect(page.locator('.popover')).toContainText('Cheapest hours tonight');
    await staff.context().close();
  });

  test('reset from the staff app restores the customer app', async ({ page, browser }) => {
    await fresh(page);
    await page.request.post('/api/installment', { data: { amount: 230 } });
    const staff = await staffPage(browser, '/staff/demo');
    staff.once('dialog', (d) => void d.accept()); // "Reset the demo?" confirmation
    await staff.getByRole('button', { name: /Reset demo/ }).click();
    await expect.poll(async () => (await (await page.request.get('/api/billing')).json()).installment.pending).toBeNull();
    await staff.context().close();
  });

  test('start page links every app and shows the phone QR', async ({ page }) => {
    await fresh(page, '/');
    await expect(page.locator('h1')).toHaveText('ENGIE360 demo');
    await expect(page.getByRole('img', { name: 'PowerConnect.AI' })).toBeVisible();
    await expect(page.locator('.mark')).toHaveText('ENGIE');
    expect((await page.request.get('/fonts/lato-900.woff2')).headers()['content-type']).toBe('font/woff2');
    for (const href of ['/staff', '/app', '/staff/demo', '/staff/preview']) await expect(page.locator(`a[href="${href}"]`)).toBeVisible();
    await expect(page.locator('.phone svg')).toBeVisible();
    await expect(page.locator('.phone code')).toContainText('/app');
    // The old address still works.
    await page.goto('/start');
    await expect(page).toHaveURL(/\/$/);
  });
});

test('a staff message written by hand is shown as read once the customer opens it', async ({ page, browser }) => {
  await fresh(page);
  const staff = await staffPage(browser, '/staff/messages');
  await staff.getByLabel('Title', { exact: true }).fill('Hello Sanne');
  await staff.getByLabel('Message', { exact: true }).fill('Thanks for being a customer.');
  await staff.getByRole('button', { name: /^Send$/ }).click();
  await expect(page.locator('.toast').last()).toContainText('Hello Sanne', { timeout: 8000 });
  await page.getByRole('button', { name: /Notifications/ }).click();
  await page.locator('.pop-item', { hasText: 'Hello Sanne' }).click();
  await expect(staff.locator('.staff-feed')).toContainText('Read “Hello Sanne”', { timeout: 8000 });
  await staff.context().close();
});
