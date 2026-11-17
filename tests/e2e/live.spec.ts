import type { Browser, Page } from '@playwright/test';
import { ask, expect, fresh, openEva, test } from './fixtures';

// The customer app runs at phone size (as on a real phone); the staff app gets its own laptop-size window below.
test.use({ viewport: { width: 390, height: 844 } });

/** The customer portal and the staff app side by side, as in the live demo. */
async function staffPage(browser: Browser, path = '/staff'): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((short) => {
    localStorage.setItem('engie-demo-lang', 'en');
    // See fixtures.ts: start with short live streams on a network that holds streams back.
    if (short) sessionStorage.setItem('engie-demo-short-streams', '1');
  }, process.env.E2E_SHORT_STREAMS === '1');
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
    expect((await r.json()).customer.firstName).toBe('Olivia');
    const msgs = await (await page.request.get('/api/messages')).json();
    expect(msgs).toHaveLength(4);
  });

  test('installment change shows up in the staff activity feed', async ({ page, browser }) => {
    await fresh(page, '/app/billing?adjust=1');
    const staff = await staffPage(browser, '/staff/customers/C-2003418762');
    await page.locator('.modal input[type=range]').fill('210');
    await page.getByRole('button', { name: /Confirm/ }).click();
    // The customer's page shows it as part of their current visit.
    await expect(staff.locator('.visits > li').first()).toContainText('Changed installment to €210 from December', { timeout: 8000 });
    await expect(staff.locator('.visits > li').first()).toContainText('In the app now');
    await expect(staff.locator('.cust-head .badge', { hasText: 'In the app now' })).toBeVisible();
    // The Customer activity table has it too, under the Billing filter.
    await staff.getByRole('link', { name: 'Customer activity' }).click();
    await staff.locator('.pills').getByRole('button', { name: 'Billing' }).click();
    await expect(staff.locator('.staff-table tbody tr', { hasText: 'Olivia Carter' })).toHaveCount(1);
    // Survives a reload: it came from the server, not page state.
    await page.reload();
    await expect(page.locator('body')).toContainText('210');
    await staff.context().close();
  });

  test('paying a bill: pay sheet, tick, invoice paid, and staff see it', async ({ page, browser }) => {
    await fresh(page, '/app/billing');
    const staff = await staffPage(browser, '/staff/customers/C-2003418762');
    // Automatic payment is on, so paying yourself is the secondary option.
    await page.getByRole('button', { name: 'Pay now instead' }).click();
    const sheet = page.locator('.modal.sheet');
    await expect(sheet).toContainText('€185.00');
    await sheet.getByRole('radio', { name: /iDEAL/ }).click();
    await sheet.locator('select').selectOption('ING');
    await sheet.getByRole('button', { name: /^Pay €185\.00/ }).click();
    await expect(sheet).toContainText('Processing your payment');
    // The tick and the confirmation.
    await expect(sheet.locator('.pay-tick')).toBeVisible({ timeout: 8000 });
    await expect(sheet).toContainText('Payment received');
    await expect(sheet).toContainText('iDEAL · ING');
    const [receipt] = await Promise.all([page.waitForEvent('download'), sheet.getByRole('button', { name: 'Receipt' }).click()]);
    expect(receipt.suggestedFilename()).toMatch(/^PAY-\d+\.pdf$/);
    await sheet.getByRole('button', { name: 'Done' }).click();
    // The screen follows: nothing left to pay, the invoice is paid.
    await expect(page.locator('body')).toContainText('You are all paid up');
    await expect(page.getByRole('button', { name: /Pay now/ })).toHaveCount(0);
    await expect(page.locator('#invoices tbody tr').first()).toContainText('Paid');
    // Staff see the payment live.
    await expect(staff.locator('.visits > li').first()).toContainText('Paid November 2026 · €185.00 with iDEAL · ING', { timeout: 8000 });
    // It came from the server: a reload keeps it, and Home moves on to December.
    await page.reload();
    await expect(page.locator('body')).toContainText('You are all paid up');
    await page.goto('/app');
    await expect(page.locator('.hero-pay')).toContainText('28 Dec');
    await staff.context().close();
  });

  test('automatic payment can be switched off and on', async ({ page }) => {
    await fresh(page, '/app/billing');
    const toggle = page.getByRole('switch', { name: 'Automatic payment' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await page.locator('.modal').getByRole('button', { name: 'Switch off' }).click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('button', { name: 'Pay now', exact: true })).toBeVisible();
    await expect(page.locator('#invoices tbody tr').first()).toContainText('Open');
    // Saved on the server (on a slow connection the request is still on its way right after the click).
    await expect.poll(async () => (await (await page.request.get('/api/billing')).json()).pay.autopay).toBe(false);
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Automatic payment' })).toHaveAttribute('aria-checked', 'false');
  });

  test('closing the app and opening it again starts from the original data', async ({ page, browser }) => {
    await fresh(page, '/app/billing');
    // The customer switches automatic payment off and changes the installment.
    await page.getByRole('switch', { name: 'Automatic payment' }).click();
    await page.locator('.modal').getByRole('button', { name: 'Switch off' }).click();
    await expect.poll(async () => (await (await page.request.get('/api/billing')).json()).pay.autopay).toBe(false);
    // A reload of the running app keeps the change…
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Automatic payment' })).toHaveAttribute('aria-checked', 'false');
    // …but a new launch (the app was closed: a new browser session) restores everything.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => {
      localStorage.setItem('engie-demo-lang', 'en');
      localStorage.setItem('engie-demo-session', 'C-2003418762');
    });
    const relaunched = await ctx.newPage();
    await relaunched.goto('/app/billing');
    await expect(relaunched.getByRole('switch', { name: 'Automatic payment' })).toHaveAttribute('aria-checked', 'true');
    await expect(relaunched.getByRole('button', { name: 'Pay now instead' })).toBeVisible();
    expect((await (await page.request.get('/api/billing')).json()).pay).toEqual({ autopay: true, paid: [] });
    await ctx.close();
  });

  test('Eva conversations appear live on the customer\'s page', async ({ page, browser }) => {
    await fresh(page);
    // The separate conversations page is gone; its old address opens the customer's Eva tab.
    const staff = await staffPage(browser, '/staff/conversations');
    await expect(staff).toHaveURL(/\/staff\/customers\/C-2003418762\?tab=eva$/);
    await openEva(page);
    await ask(page, 'Why is my energy bill higher this month?');
    await expect(staff.locator('.staff-thread')).toContainText('Why is my energy bill higher this month?', { timeout: 8000 });
    await expect(staff.locator('.staff-thread')).toContainText('12% higher');
    await staff.context().close();
  });

  test('a staff message arrives in the customer app as a banner and in the inbox', async ({ page, browser }) => {
    await fresh(page);
    const staff = await staffPage(browser, '/staff/demo');
    await expect(staff.locator('.badge', { hasText: 'Olivia is in the app' })).toBeVisible();
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
    for (const href of ['/staff', '/app', '/staff/demo']) await expect(page.locator(`a[href="${href}"]`)).toBeVisible();
    await expect(page.locator('.phone svg')).toBeVisible();
    await expect(page.locator('.phone code')).toContainText('/app');
    // The old address still works.
    await page.goto('/start');
    await expect(page).toHaveURL(/\/$/);
  });
});

test('a staff message written by hand is shown as read once the customer opens it', async ({ page, browser }) => {
  await fresh(page);
  const staff = await staffPage(browser, '/staff/messages?customer=C-2003418762');
  await expect(staff.locator('.aud-picked')).toContainText('Olivia Carter');
  await staff.getByLabel('Title', { exact: true }).fill('Hello Olivia');
  await staff.getByLabel('Message', { exact: true }).fill('Thanks for being a customer.');
  await staff.getByRole('button', { name: /^Send$/ }).click();
  await expect(page.locator('.toast').last()).toContainText('Hello Olivia', { timeout: 8000 });
  const row = staff.locator('.history-table tbody tr', { hasText: 'Hello Olivia' });
  await expect(row).toContainText('Not yet');
  await page.getByRole('button', { name: /Notifications/ }).click();
  await page.locator('.pop-item', { hasText: 'Hello Olivia' }).click();
  await expect(row).toContainText('Yes', { timeout: 8000 });
  await staff.context().close();
});
