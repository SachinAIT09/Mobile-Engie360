import { ask, expect, fresh, noHorizontalScroll, openEva, test } from './fixtures';

const ROUTES = ['/', '/app', '/app/energy', '/app/billing', '/app/insights', '/app/smart-energy', '/app/assistant', '/app/account', '/staff', '/staff/activity', '/staff/demo'];

test('no horizontal scrolling on any screen at 390 px', async ({ page }) => {
  await fresh(page);
  for (const r of ROUTES) {
    await page.goto(r);
    await page.waitForTimeout(500);
    expect(await noHorizontalScroll(page), r).toBe(true);
  }
});

test('sign-in fits a phone', async ({ page }) => {
  await fresh(page, '/app', { signedIn: false });
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeInViewport();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('bottom tabs and full-screen Eva', async ({ page }) => {
  await fresh(page);
  const tabs = page.locator('.app-tabs');
  await expect(tabs).toBeVisible();
  await tabs.getByRole('link', { name: 'Billing' }).click();
  await expect(page).toHaveURL(/\/app\/billing$/);
  await openEva(page);
  // Full screen once the open animation (a slight scale-in) has finished.
  await expect.poll(async () => Math.round((await page.locator('.chat-widget').boundingBox())?.width ?? 0)).toBe(390);
  await ask(page, 'When should I charge my EV?');
});

test('the staff app works on a phone with the drawer', async ({ page }) => {
  await fresh(page, '/staff');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('.rs.nav-open .rs-rail')).toBeVisible();
  await page.locator('.rs-rail a', { hasText: 'Customer activity' }).click();
  await expect(page).toHaveURL(/\/staff\/activity$/);
  await expect(page.locator('.rs.nav-open')).toHaveCount(0);
});

// Height budgets (in phone screens) so the customer app does not grow back into long scrolling pages.
const BUDGET: Record<string, number> = { '/app': 2.2, '/app/energy': 2.0, '/app/billing': 2.3, '/app/insights': 2.0, '/app/smart-energy': 2.4, '/app/account': 2.0 };

test('customer screens stay short: about two phone screens at most', async ({ page }) => {
  await fresh(page);
  for (const [route, max] of Object.entries(BUDGET)) {
    await page.goto(route);
    await expect(page.locator('.app-tabs')).toBeVisible();
    await page.waitForTimeout(700);
    const screens = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
    expect(screens, route).toBeLessThanOrEqual(max);
  }
});

test('the customer app shows no scrollbar and a link to a section opens it', async ({ page }) => {
  await fresh(page, '/app/insights#night-anomaly');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth)).toBe('none');
  await expect(page.locator('#night-anomaly .insight-body')).toBeVisible();
});
